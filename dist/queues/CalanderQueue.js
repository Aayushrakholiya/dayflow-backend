"use strict";
// CalendarImportService.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCalendarConnectionStatus = getCalendarConnectionStatus;
exports.connectCalendarViaPopup = connectCalendarViaPopup;
exports.syncCalendar = syncCalendar;
exports.disconnectCalendar = disconnectCalendar;
exports.getImportedEvents = getImportedEvents;
exports.updateImportedEventLocation = updateImportedEventLocation;
const API_BASE = process.env.API_BASE_URL ?? "http://localhost:4000";
// ── Connection status ─────────────────────────────────────────────────────────
async function getCalendarConnectionStatus(userId, provider) {
    try {
        const res = await fetch(`${API_BASE}/api/${provider}-calendar/status?userId=${userId}`);
        if (!res.ok)
            return false;
        const data = await res.json();
        return !!data.connected;
    }
    catch {
        return false;
    }
}
// ── OAuth popup ───────────────────────────────────────────────────────────────
const POPUP_MESSAGE_TYPES = {
    google: "GOOGLE_CALENDAR_CONNECTED",
    microsoft: "MICROSOFT_CALENDAR_CONNECTED",
};
function connectCalendarViaPopup(userId, provider) {
    return new Promise(async (resolve, reject) => {
        try {
            const res = await fetch(`${API_BASE}/api/${provider}-calendar/auth-url?userId=${userId}`);
            if (!res.ok)
                throw new Error("Failed to get auth URL");
            const { url } = await res.json();
            const popup = window.open(url, `connect_${provider}`, "width=520,height=640,left=200,top=100");
            if (!popup) {
                reject(new Error("Popup was blocked — please allow popups for this site."));
                return;
            }
            const expectedType = POPUP_MESSAGE_TYPES[provider];
            const handler = (event) => {
                if (event.data?.type === expectedType) {
                    window.removeEventListener("message", handler);
                    clearInterval(closedPoll);
                    resolve();
                }
            };
            window.addEventListener("message", handler);
            const closedPoll = setInterval(() => {
                if (popup.closed) {
                    clearInterval(closedPoll);
                    window.removeEventListener("message", handler);
                    reject(new Error("OAuth popup was closed before completing authorization."));
                }
            }, 500);
        }
        catch (err) {
            reject(err);
        }
    });
}
// ── Sync ──────────────────────────────────────────────────────────────────────
async function syncCalendar(userId, provider) {
    const res = await fetch(`${API_BASE}/api/${provider}-calendar/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? "Sync failed");
    }
    return res.json();
}
// ── Disconnect ────────────────────────────────────────────────────────────────
async function disconnectCalendar(userId, provider) {
    const res = await fetch(`${API_BASE}/api/${provider}-calendar/disconnect`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
    });
    if (!res.ok)
        throw new Error("Disconnect failed");
}
// ── Fetch imported events ─────────────────────────────────────────────────────
async function getImportedEvents(userId) {
    const res = await fetch(`${API_BASE}/api/imported-events?userId=${userId}`);
    if (!res.ok)
        throw new Error("Failed to fetch imported events");
    const data = await res.json();
    return (data.events ?? []).map((ev) => ({
        ...ev,
        date: new Date(ev.date),
    }));
}
// ── Update location override ──────────────────────────────────────────────────
async function updateImportedEventLocation(id, userId, locationOverride) {
    const res = await fetch(`${API_BASE}/api/imported-events/${id}/location`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, locationOverride }),
    });
    if (!res.ok)
        throw new Error("Failed to update location");
    const data = await res.json();
    return { ...data.event, date: new Date(data.event.date) };
}
