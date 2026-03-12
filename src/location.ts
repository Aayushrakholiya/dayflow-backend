import process from "node:process";
import express, { Request, Response } from "express";

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const ORS_BASE = "https://api.openrouteservice.org";

type TravelMode = "DRIVING" | "WALKING" | "TRANSIT" | "BICYCLING";

const ORS_PROFILE: Record<TravelMode, string> = {
  DRIVING: "driving-car",
  WALKING: "foot-walking",
  BICYCLING: "cycling-regular",
  TRANSIT: "driving-hgv",
};

const pad2 = (n: number) => String(n).padStart(2, "0");

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h} hr ${m} min`;
  return `${m} min`;
}

function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

function formatDepartBy(eventStartHour: number, travelSeconds: number): string {
  const departSec = eventStartHour * 3600 - travelSeconds - 300;
  if (departSec < 0) return "Leave now!";
  const h24 = Math.floor(departSec / 3600);
  const mins = Math.floor((departSec % 3600) / 60);
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const ampm = h24 < 12 ? "AM" : "PM";
  return `Leave by ${h12}:${pad2(mins)} ${ampm}`;
}

async function geocodeAddress(
  address: string,
  country?: string,
): Promise<{ lat: number; lng: number } | null> {
  const url = new URL(`${NOMINATIM_BASE}/search`);
  url.searchParams.set("q", address);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");
  if (country) url.searchParams.set("countrycodes", country.toLowerCase());

  const res = await fetch(url.toString(), {
    headers: {
      "Accept-Language": "en",
      "User-Agent": "DayflowCalendar/1.0 (help.dayflow@gmail.com)",
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

export default function createLocationRouter() {
  const router = express.Router();

  router.post("/eta", async (req: Request, res: Response) => {
    const key = process.env.ORS_API_KEY;
    if (!key)
      return res.status(503).json({ error: "ORS_API_KEY not configured" });

    const {
      origin,
      destination,
      eventStartHour,
      mode = "DRIVING",
    } = req.body as {
      origin: { lat: number; lng: number };
      destination: string | { lat: number; lng: number };
      eventStartHour: number;
      mode?: TravelMode;
    };

    if (!origin || !destination)
      return res
        .status(400)
        .json({ error: "origin and destination are required" });

    try {
      const destCoords =
        typeof destination === "string"
          ? await geocodeAddress(destination)
          : destination;

      if (!destCoords)
        return res.status(404).json({ error: "Could not geocode destination" });

      const profile = ORS_PROFILE[mode];
      const isDriving = mode === "DRIVING";
      const orsBody: Record<string, unknown> = {
        coordinates: [
          [origin.lng, origin.lat],
          [destCoords.lng, destCoords.lat],
        ],
        instructions: true,
      };
      if (isDriving) orsBody.attributes = ["avgspeed"];

      const orsRes = await fetch(
        `${ORS_BASE}/v2/directions/${profile}/geojson`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: key },
          body: JSON.stringify(orsBody),
        },
      );

      if (!orsRes.ok) {
        const orsErrBody = await orsRes.text().catch(() => "");
        console.error("[ORS] status:", orsRes.status, "body:", orsErrBody);
        return res
          .status(502)
          .json({ error: "ORS request failed", orsStatus: orsRes.status });
      }

      const data = await orsRes.json();
      const feature = data?.features?.[0];
      const props = feature?.properties;
      const summary = props?.summary;
      if (!summary) return res.status(502).json({ error: "No route found" });

      const durationSeconds = Math.round(summary.duration as number);
      const distanceMeters = Math.round(summary.distance as number);

      let trafficDurationText: string | undefined;
      if (isDriving) {
        const avgSpeed: number = props?.segments?.[0]?.avgspeed ?? 0;
        if (avgSpeed > 0 && avgSpeed < 25)
          trafficDurationText = formatDuration(
            Math.round(durationSeconds * 1.2),
          );
      }

      const geojsonCoords: [number, number][] =
        feature?.geometry?.coordinates ?? [];
      const routeGeometry: [number, number][] = geojsonCoords.map(
        ([lng, lat]: [number, number]) => [lat, lng],
      );

      interface OrsStep {
        instruction: string;
        distance: number;
        duration: number;
        type: number;
      }
      interface OrsSeg {
        steps: OrsStep[];
      }
      const steps = (props?.segments ?? []).flatMap((seg: OrsSeg) =>
        (seg.steps ?? [])
          .filter((s: OrsStep) => s.type !== 10)
          .map((s: OrsStep) => ({
            instruction: s.instruction,
            distanceText: formatDistance(Math.round(s.distance)),
            durationText: formatDuration(Math.round(s.duration)),
            type: s.type,
          })),
      );

      return res.json({
        durationText: formatDuration(durationSeconds),
        durationSeconds,
        distanceText: formatDistance(distanceMeters),
        distanceMeters,
        departByText: formatDepartBy(eventStartHour, durationSeconds),
        trafficDurationText,
        mode,
        routeGeometry,
        destCoords,
        steps,
      });
    } catch (err) {
      console.error("ETA error:", err);
      return res.status(500).json({ error: "Failed to calculate route" });
    }
  });

  router.get("/geocode", async (req: Request, res: Response) => {
    const address = req.query.address as string;
    const country = req.query.country as string | undefined;
    if (!address?.trim())
      return res.status(400).json({ error: "address is required" });

    try {
      const coords = await geocodeAddress(address, country);
      if (!coords) return res.status(404).json({ error: "Address not found" });
      return res.json(coords);
    } catch (err) {
      console.error("Geocode error:", err);
      return res.status(500).json({ error: "Geocode failed" });
    }
  });

  router.get("/place", async (req: Request, res: Response) => {
    const locationText = req.query.q as string;
    const country = req.query.country as string | undefined;
    if (!locationText?.trim())
      return res.status(400).json({ error: "q is required" });

    const UA = "DayflowCalendar/1.0 (help.dayflow@gmail.com)";

    try {
      const nmUrl = new URL(`${NOMINATIM_BASE}/search`);
      nmUrl.searchParams.set("q", locationText);
      nmUrl.searchParams.set("format", "json");
      nmUrl.searchParams.set("limit", "1");
      nmUrl.searchParams.set("addressdetails", "1");
      nmUrl.searchParams.set("extratags", "1");
      if (country)
        nmUrl.searchParams.set("countrycodes", country.toLowerCase());

      const nmRes = await fetch(nmUrl.toString(), {
        headers: { "Accept-Language": "en", "User-Agent": UA },
      });
      if (!nmRes.ok)
        return res.status(502).json({ error: "Nominatim search failed" });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nmData: unknown[] = await nmRes.json();
      if (!Array.isArray(nmData) || !nmData.length)
        return res.status(404).json({ error: "Place not found" });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hit: unknown = nmData[0];
      const hit_as_any = hit as any;
      const lat = parseFloat(hit_as_any.lat as string);
      const lng = parseFloat(hit_as_any.lon as string);
      const osmType = hit_as_any.osm_type as string;
      const osmId = hit_as_any.osm_id as number;
      const addr = hit_as_any.address ?? {};
      const extraTags = hit_as_any.extratags ?? {};

      const formattedAddress = [
        addr.house_number
          ? `${addr.house_number} ${addr.road ?? ""}`.trim()
          : addr.road,
        addr.city ?? addr.town ?? addr.village ?? addr.county,
        addr.state,
        addr.country,
      ]
        .filter(Boolean)
        .join(", ");

      const placeName: string =
        hit_as_any.name ||
        extraTags.name ||
        addr.amenity ||
        addr.shop ||
        addr.building ||
        locationText;

      const ovTypeMap: Record<string, string> = {
        node: "node",
        way: "way",
        relation: "rel",
      };
      const ovType = ovTypeMap[osmType] ?? "node";
      const overpassQuery = `[out:json][timeout:10];${ovType}(${osmId});out tags;`;

      let tags: Record<string, string> = {};
      try {
        const ovRes = await fetch("https://overpass-api.de/api/interpreter", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": UA,
          },
          body: `data=${encodeURIComponent(overpassQuery)}`,
        });
        if (ovRes.ok) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const ovData: unknown = await ovRes.json();
          const ovData_as_any = ovData as any;
          tags = ovData_as_any?.elements?.[0]?.tags ?? {};
        }
      } catch (_err) {
        console.error("Overpass error:", _err);
      }

      const ohRaw: string | undefined = tags["opening_hours"];
      let isOpen: boolean | null = null;
      let openingHoursText: string | null = null;

      if (ohRaw) {
        openingHoursText = ohRaw;
        try {
          const now = new Date();
          const dayIdx = now.getDay();
          const dayAbbr = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][dayIdx];
          const nowMin = now.getHours() * 60 + now.getMinutes();
          const rules = ohRaw.split(";").map((r) => r.trim());
          let matched = false;

          for (const rule of rules) {
            if (/^PH|^SH/i.test(rule)) continue;
            if (/^24\/7/i.test(rule)) {
              isOpen = true;
              matched = true;
              break;
            }

            const m = rule.match(
              /^([A-Za-z,\-\s]+?)\s+(\d{2}:\d{2})-(\d{2}:\d{2})(?:\s+off)?/,
            );
            if (!m) continue;

            const dayPart = m[1].trim();
            const [oh, om] = m[2].split(":").map(Number);
            const [ch, cm] = m[3].split(":").map(Number);
            const openMin = oh * 60 + om;
            let closeMin = ch * 60 + cm;
            if (closeMin <= openMin) closeMin += 24 * 60;

            const dayCovers = (spec: string): boolean => {
              const parts = spec.split(",").map((s) => s.trim());
              for (const part of parts) {
                if (part.includes("-")) {
                  const days = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
                  const [from, to] = part
                    .split("-")
                    .map((d) => days.indexOf(d.trim()));
                  if (from !== -1 && to !== -1) {
                    const range =
                      from <= to
                        ? days.slice(from, to + 1)
                        : [...days.slice(from), ...days.slice(0, to + 1)];
                    if (range.includes(dayAbbr)) return true;
                  }
                } else if (part === dayAbbr) return true;
              }
              return false;
            };

            if (dayCovers(dayPart)) {
              matched = true;
              isOpen =
                !/off/i.test(rule) && nowMin >= openMin && nowMin < closeMin;
              break;
            }
          }
          if (!matched) isOpen = false;
        } catch (err) {
          console.error("Opening hours parse error:", err);
        }
      }

      const phone: string | null =
        tags["phone"] ?? tags["contact:phone"] ?? null;
      const website: string | null =
        tags["website"] ?? tags["contact:website"] ?? null;

      return res.json({
        placeId: String(osmId),
        name: tags["name"] ?? placeName,
        formattedAddress: formattedAddress || locationText,
        location: { lat, lng },
        isOpen,
        openingHoursText,
        phone,
        website,
        mapsUrl: `https://www.openstreetmap.org/${osmType}/${osmId}`,
      });
    } catch (err) {
      console.error("Place error:", err);
      return res.status(500).json({ error: "Place lookup failed" });
    }
  });

  router.get("/autocomplete", async (req: Request, res: Response) => {
    const input = req.query.q as string;
    if (!input?.trim()) return res.status(400).json({ error: "q is required" });

    const country = req.query.country as string | undefined;
    const userLat = req.query.lat
      ? parseFloat(req.query.lat as string)
      : undefined;
    const userLng = req.query.lng
      ? parseFloat(req.query.lng as string)
      : undefined;
    const hasUserCoords = userLat !== undefined && userLng !== undefined;

    try {
      const nmUrl = new URL(`${NOMINATIM_BASE}/search`);
      nmUrl.searchParams.set("q", input);
      nmUrl.searchParams.set("format", "json");
      nmUrl.searchParams.set("limit", "6");
      nmUrl.searchParams.set("addressdetails", "1");
      nmUrl.searchParams.set("dedupe", "1");
      if (country)
        nmUrl.searchParams.set("countrycodes", country.toLowerCase());
      if (hasUserCoords) {
        nmUrl.searchParams.set(
          "viewbox",
          `${userLng! - 0.5},${userLat! + 0.5},${userLng! + 0.5},${userLat! - 0.5}`,
        );
        nmUrl.searchParams.set("bounded", "0");
      }

      const nmRes = await fetch(nmUrl.toString(), {
        headers: {
          "Accept-Language": "en",
          "User-Agent": "DayflowCalendar/1.0 (help.dayflow@gmail.com)",
        },
      });
      if (!nmRes.ok) return res.json([]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nmData: unknown[] = await nmRes.json();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results = (Array.isArray(nmData) ? nmData : []).map((item: unknown) => {
        const item_as_any = item as any;
        const addr = item_as_any.address ?? {};
        const mainText: string =
          addr.amenity ??
          addr.shop ??
          addr.building ??
          addr.road ??
          addr.neighbourhood ??
          (item_as_any.display_name as string).split(",")[0];
        const secondary = [
          addr.house_number
            ? `${addr.house_number} ${addr.road ?? ""}`.trim()
            : undefined,
          addr.city ?? addr.town ?? addr.village ?? addr.county,
          addr.state,
          addr.country,
        ]
          .filter(Boolean)
          .join(", ");

        return {
          placeId: String(item_as_any.place_id),
          description: item_as_any.display_name as string,
          mainText,
          secondaryText: secondary,
          coords: {
            lat: parseFloat(item_as_any.lat as string),
            lng: parseFloat(item_as_any.lon as string),
          },
        };
      });

      return res.json(results);
    } catch (err) {
      console.error("Autocomplete error:", err);
      return res.status(500).json({ error: "Autocomplete failed" });
    }
  });

  return router;
}
