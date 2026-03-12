"use strict";
// All data comes from ECCC / MSC GeoMet
// ECCC Open Licence v2.1
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = createWeatherRouter;
const express_1 = __importDefault(require("express"));
const ATTRIBUTION = "Contains information licenced under the Data Server End-use Licence of Environment and Climate Change Canada.";
// City list is downloaded once on startup and kept in memory for the whole process.
// The ECCC site list rarely changes so we never need to refresh it.
let cityCache = null;
// Converts Celsius to Fahrenheit, rounded to the nearest integer.
function cToF(c) {
    if (c === null) {
        return null;
    }
    return Math.round(c * 9 / 5 + 32);
}
// Rounds a raw sensor reading to the nearest integer, or returns null if missing.
function roundTemp(n) {
    if (n === null) {
        return null;
    }
    return Math.round(n);
}
// Returns the great-circle distance in kilometres between two lat/lon points.
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dL = (lat2 - lat1) * Math.PI / 180;
    const dO = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dL / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dO / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
// Parses a coordinate string that uses a cardinal direction suffix instead of a sign.
// ECCC's CSV stores coordinates this way — e.g. "43.59N" → 43.59, "80.48W" → -80.48.
function parseCoord(raw, axis) {
    if (!raw || raw.trim() === "") {
        return null;
    }
    const s = raw.trim().toUpperCase();
    const dir = s.slice(-1);
    const value = parseFloat(s.slice(0, -1));
    if (isNaN(value)) {
        return null;
    }
    if (axis === "lat") {
        return dir === "S" ? -value : value;
    }
    if (axis === "lon") {
        return dir === "W" ? -value : value;
    }
    return null;
}
// Extracts the text content of a named XML tag from a string.
function xmlText(xml, tag) {
    const m = new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>`, "i").exec(xml);
    return m ? m[1].trim() : "";
}
// Like xmlText but only matches a tag that also has a specific attribute value.
// Used to pull forecast high/low temperatures which share the same tag name.
function xmlTextAttr(xml, tag, attr, val) {
    const m = new RegExp(`<${tag}[^>]*${attr}="${val}"[^>]*>([^<]*)<\/${tag}>`, "i").exec(xml);
    return m ? m[1].trim() : "";
}
// Maps an ECCC condition description string to a weather emoji.
function descToIcon(desc) {
    const d = desc.toLowerCase();
    if (d.includes("thunder")) {
        return "⛈️";
    }
    if (d.includes("blizzard")) {
        return "🌨️";
    }
    if (d.includes("snow") || d.includes("flurr")) {
        return "❄️";
    }
    if (d.includes("drizzle")) {
        return "🌦️";
    }
    if (d.includes("rain") || d.includes("shower")) {
        return "🌧️";
    }
    if (d.includes("fog") || d.includes("mist")) {
        return "🌫️";
    }
    if (d.includes("wind") || d.includes("breezy")) {
        return "🌬️";
    }
    if (d.includes("overcast")) {
        return "☁️";
    }
    if (d.includes("cloud")) {
        return "⛅";
    }
    if (d.includes("mostly clear") || d.includes("mostly sunny")) {
        return "🌤️";
    }
    if (d.includes("clear") || d.includes("sunny")) {
        return "☀️";
    }
    return "🌡️";
}
// Builds a short tip to display to the user based on the current weather.
function buildTip(tempC, desc) {
    const d = desc.toLowerCase();
    if (d.includes("thunder")) {
        return { text: "Thunderstorm — stay indoors if you can.", emoji: "⚡" };
    }
    if (d.includes("blizzard")) {
        return { text: "Blizzard — avoid travel if possible.", emoji: "🌨️" };
    }
    if (d.includes("snow") || d.includes("flurr")) {
        return { text: "Snow on the way — layer up!", emoji: "🧣" };
    }
    if (d.includes("rain") || d.includes("shower") || d.includes("drizzle")) {
        return { text: "Rainy day — don't forget your umbrella!", emoji: "☂️" };
    }
    if (d.includes("fog") || d.includes("mist")) {
        return { text: "Foggy — drive carefully today.", emoji: "🚗" };
    }
    if (d.includes("wind") || d.includes("breezy")) {
        return { text: "Windy — hold onto your hat!", emoji: "💨" };
    }
    if (tempC !== null) {
        if (tempC <= -20) {
            return { text: "Extreme cold — limit time outside.", emoji: "🥶" };
        }
        if (tempC <= 0) {
            return { text: "Freezing outside — bundle up completely!", emoji: "🧤" };
        }
        if (tempC <= 8) {
            return { text: "It's cold — don't forget your coat.", emoji: "🧥" };
        }
        if (tempC <= 15) {
            return { text: "Chilly — a light jacket will do.", emoji: "🧶" };
        }
        if (tempC >= 35) {
            return { text: "Heat wave — stay hydrated!", emoji: "💧" };
        }
        if (tempC >= 28) {
            return { text: "Hot and sunny — apply sunscreen.", emoji: "🕶️" };
        }
    }
    if (d.includes("clear") || d.includes("sunny")) {
        return { text: "Beautiful day — enjoy it!", emoji: "😎" };
    }
    return { text: "Mild and pleasant outside.", emoji: "🌿" };
}
// Downloads the ECCC city site list CSV and caches it in memory.
async function loadCitySiteList() {
    if (cityCache !== null) {
        return cityCache;
    }
    const res = await fetch("https://dd.weather.gc.ca/today/citypage_weather/docs/site_list_en.csv", { headers: { "User-Agent": "CalendarWeatherWidget/1.0" }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
        throw new Error(`site_list_en.csv HTTP ${res.status}`);
    }
    const lines = (await res.text()).split("\n");
    const records = [];
    // Skip the two header rows and parse each data row
    for (let i = 2; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) {
            continue;
        }
        const firstComma = line.indexOf(",");
        const rest = line.slice(firstComma + 1);
        const lastComma = rest.lastIndexOf(",");
        const secLast = rest.lastIndexOf(",", lastComma - 1);
        const thrLast = rest.lastIndexOf(",", secLast - 1);
        const code = line.slice(0, firstComma).trim();
        const name = rest.slice(0, thrLast).trim();
        const province = rest.slice(thrLast + 1, secLast).trim();
        const latRaw = rest.slice(secLast + 1, lastComma).trim();
        const lonRaw = rest.slice(lastComma + 1).trim();
        if (!code || !name || !province || !latRaw || !lonRaw) {
            continue;
        }
        const lat = parseCoord(latRaw, "lat");
        const lon = parseCoord(lonRaw, "lon");
        if (lat === null || lon === null) {
            continue;
        }
        records.push({ code, name, province, lat, lon });
    }
    if (records.length === 0) {
        throw new Error("site_list_en.csv parsed 0 records.");
    }
    // Deduplicate — keep the last entry for each unique coordinate pair
    const coordMap = new Map();
    for (const r of records) {
        coordMap.set(`${r.lat},${r.lon}`, r);
    }
    cityCache = Array.from(coordMap.values());
    return cityCache;
}
// Scans the cached city list and returns the one closest to the given coordinates.
function findNearestCity(sites, lat, lon) {
    let nearest = sites[0];
    let minDist = Infinity;
    for (const site of sites) {
        const d = haversine(lat, lon, site.lat, site.lon);
        if (d < minDist) {
            minDist = d;
            nearest = site;
        }
    }
    return nearest;
}
// Fetches and parses the ECCC city page XML for a given site.
// ECCC keeps only 4 rolling hour folders, so we try the current UTC hour and fall back
// up to 4 hours until we find the file for this city.
async function fetchCityPageXML(site) {
    const headers = { "User-Agent": "CalendarWeatherWidget/1.0" };
    const utcHour = new Date().getUTCHours();
    for (let offset = 0; offset <= 4; offset++) {
        const hh = ((utcHour - offset + 24) % 24).toString().padStart(2, "0");
        const dirUrl = `https://dd.weather.gc.ca/today/citypage_weather/${site.province}/${hh}/`;
        try {
            const dirRes = await fetch(dirUrl, { headers, signal: AbortSignal.timeout(6000) });
            if (!dirRes.ok) {
                continue;
            }
            // Find the filename for this city in the directory listing
            const fileMatch = new RegExp(`(\\d{8}T[\\d.]+Z_MSC_CitypageWeather_${site.code}_en\\.xml)`, "i").exec(await dirRes.text());
            if (!fileMatch) {
                continue;
            }
            const xmlRes = await fetch(`${dirUrl}${fileMatch[1]}`, {
                headers,
                signal: AbortSignal.timeout(8000),
            });
            if (!xmlRes.ok) {
                continue;
            }
            const xml = await xmlRes.text();
            const city = xmlText(xml, "name") || site.name;
            const desc = xmlText(xml, "condition");
            const tempRaw = parseFloat(xmlText(xml, "temperature"));
            const tempC = isNaN(tempRaw) ? null : Math.round(tempRaw);
            // Wind chill appears in winter, humidex in summer — the XML only includes one at a time
            const windChill = parseFloat(xmlText(xml, "windChill"));
            const humidex = parseFloat(xmlText(xml, "humidex"));
            const feelsC = !isNaN(windChill)
                ? Math.round(windChill)
                : !isNaN(humidex)
                    ? Math.round(humidex)
                    : null;
            const humRaw = parseFloat(xmlText(xml, "relativeHumidity"));
            const humidity = isNaN(humRaw) ? null : Math.round(humRaw);
            const windRaw = parseFloat(xmlText(xml, "speed"));
            const windKmh = isNaN(windRaw) ? null : Math.round(windRaw);
            const highRaw = parseFloat(xmlTextAttr(xml, "temperature", "class", "high"));
            const lowRaw = parseFloat(xmlTextAttr(xml, "temperature", "class", "low"));
            const tempMaxC = isNaN(highRaw) ? null : Math.round(highRaw);
            const tempMinC = isNaN(lowRaw) ? null : Math.round(lowRaw);
            return { city, desc, tempC, feelsC, humidity, windKmh, tempMaxC, tempMinC };
        }
        catch {
            continue;
        }
    }
    return null;
}
// Fetches temperature and humidity from the nearest physical weather station
async function fetchSwob(lat, lon) {
    const delta = 0.8; // roughly 90 km in each direction
    const url = new URL("https://api.weather.gc.ca/collections/swob-realtime/items");
    url.searchParams.set("bbox", `${(lon - delta).toFixed(4)},${(lat - delta).toFixed(4)},${(lon + delta).toFixed(4)},${(lat + delta).toFixed(4)}`);
    url.searchParams.set("sortby", "-date_tm-value");
    url.searchParams.set("limit", "50");
    url.searchParams.set("f", "json");
    const res = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
        throw new Error(`SWOB HTTP ${res.status}`);
    }
    const json = await res.json();
    if (!json.features?.length) {
        throw new Error("No SWOB station within 90 km.");
    }
    // Keep only the most recent observation per station (list is pre-sorted by timestamp)
    const seen = new Set();
    const stations = [];
    for (const f of json.features) {
        const name = String(f.properties["stn_nam-value"] ?? "");
        if (!seen.has(name)) {
            seen.add(name);
            stations.push(f);
        }
    }
    // Pick the station that is geographically closest to the user
    let best = stations[0];
    let minDist = Infinity;
    for (const s of stations) {
        const sLon = s.geometry.coordinates[0];
        const sLat = s.geometry.coordinates[1];
        if (!sLat || !sLon) {
            continue;
        }
        const d = haversine(lat, lon, sLat, sLon);
        if (d < minDist) {
            minDist = d;
            best = s;
        }
    }
    // Helper to safely read a numeric property from the station data
    const num = (k) => {
        const v = best.properties[k];
        if (v === null || v === undefined || v === "") {
            return null;
        }
        const n = parseFloat(String(v));
        return isNaN(n) ? null : n;
    };
    return {
        tempC: roundTemp(num("air_temp")),
        humidity: roundTemp(num("rel_hum")),
    };
}
function createWeatherRouter() {
    const router = express_1.default.Router();
    // Pre-warm the city cache so the first request doesn't pay the download cost.
    loadCitySiteList().catch(() => { });
    // GET /api/weather?lat=&lon= — returns weather for the nearest city.
    // SWOB (station sensor) and city XML are fetched in parallel. If one fails the other
    // is used as a fallback
    router.get("/weather", async (req, res) => {
        try {
            const { lat: latRaw, lon: lonRaw } = req.query;
            if (!latRaw || !lonRaw) {
                return res.status(400).json({ message: "Query parameters 'lat' and 'lon' are required." });
            }
            const lat = parseFloat(String(latRaw));
            const lon = parseFloat(String(lonRaw));
            if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
                return res.status(400).json({ message: "Invalid 'lat' or 'lon' values." });
            }
            // Rough bounding box covering Canada
            if (lat < 41.7 || lat > 83.1 || lon < -141.0 || lon > -52.6) {
                return res.status(400).json({
                    message: "This weather service currently covers Canadian locations only.",
                });
            }
            let sites;
            try {
                sites = await loadCitySiteList();
            }
            catch {
                return res.status(503).json({ message: "Weather service temporarily unavailable." });
            }
            const nearest = findNearestCity(sites, lat, lon);
            const [swobSettled, xmlSettled] = await Promise.allSettled([
                fetchSwob(lat, lon),
                fetchCityPageXML(nearest),
            ]);
            const swob = swobSettled.status === "fulfilled" ? swobSettled.value : null;
            const xml = xmlSettled.status === "fulfilled" ? xmlSettled.value : null;
            if (!swob && !xml) {
                return res.status(503).json({ message: "Weather data temporarily unavailable." });
            }
            // SWOB temperature takes priority over XML because it comes from a physical sensor
            const tempC = swob?.tempC ?? xml?.tempC ?? null;
            const humidity = swob?.humidity ?? xml?.humidity ?? null;
            const feelsC = xml?.feelsC ?? null;
            const windKmh = xml?.windKmh ?? null;
            const tempMaxC = xml?.tempMaxC ?? null;
            const tempMinC = xml?.tempMinC ?? null;
            const desc = xml?.desc ?? "";
            const city = xml?.city ?? nearest.name;
            return res.status(200).json({
                tempC,
                feelsC,
                tempMaxC,
                tempMinC,
                tempF: cToF(tempC),
                feelsF: cToF(feelsC),
                tempMaxF: cToF(tempMaxC),
                tempMinF: cToF(tempMinC),
                humidity,
                windKmh,
                desc,
                icon: descToIcon(desc),
                tip: buildTip(tempC, desc),
                city,
                source: "MSC GeoMet",
                attribution: ATTRIBUTION,
            });
        }
        catch {
            return res.status(500).json({ message: "Internal server error." });
        }
    });
    return router;
}
