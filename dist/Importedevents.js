"use strict";
/*
*  FILE          : Importedevents.ts
*  PROJECT       : PROG3221 - capstone
*  PROGRAMMER    : Ayushkumar Rakholiya, Jal Shah, Darsh Patel and Virajsinh Solanki
*  FIRST VERSION : 2026-02-01
*  DESCRIPTION   :
*    Manages imported events from Google and Microsoft calendars with upsert and deletion.
*/
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertImportedEvents = upsertImportedEvents;
exports.deleteImportedEventsBySource = deleteImportedEventsBySource;
exports.createImportedEventsRouter = createImportedEventsRouter;
const express_1 = __importDefault(require("express"));
// ── Prisma (shared singleton) ────────────────────────────────────────────────
const db_1 = __importDefault(require("./db"));
// ── Write helpers ─────────────────────────────────────────────────────────────
const CHUNK_SIZE = 50;
async function upsertImportedEvents(userId, events) {
    const source = events[0]?.source;
    if (source) {
        const incomingIds = new Set(events.map((ev) => ev.externalId));
        const existing = await db_1.default.importedEvent.findMany({
            where: { userId, source },
            select: { id: true, externalId: true },
        });
        const toDelete = existing
            .filter((row) => !incomingIds.has(row.externalId))
            .map((row) => row.id);
        if (toDelete.length > 0) {
            await db_1.default.importedEvent.deleteMany({
                where: { id: { in: toDelete } },
            });
        }
    }
    if (!events.length)
        return;
    // ── Step 2: Upsert all incoming events ────────────────────────────────────
    // Process in chunks of 50 to avoid transaction timeouts on large calendars
    for (let i = 0; i < events.length; i += CHUNK_SIZE) {
        const chunk = events.slice(i, i + CHUNK_SIZE);
        await db_1.default.$transaction(chunk.map((ev) => db_1.default.importedEvent.upsert({
            where: {
                userId_externalId_source: {
                    userId,
                    externalId: ev.externalId,
                    source: ev.source,
                },
            },
            create: {
                userId,
                externalId: ev.externalId,
                source: ev.source,
                title: ev.title,
                date: ev.date,
                startHour: ev.startHour,
                endHour: ev.endHour,
                location: ev.location ?? null,
                locationOverride: null,
                description: ev.description ?? null,
                attendees: ev.attendees,
                videoconferencing: ev.videoconferencing ?? null,
                color: ev.color,
                calendarName: ev.calendarName,
            },
            update: {
                // locationOverride is never overwritten by sync
                title: ev.title,
                date: ev.date,
                startHour: ev.startHour,
                endHour: ev.endHour,
                location: ev.location ?? null,
                description: ev.description ?? null,
                attendees: ev.attendees,
                videoconferencing: ev.videoconferencing ?? null,
                color: ev.color,
                calendarName: ev.calendarName,
            },
        })));
    }
}
async function deleteImportedEventsBySource(userId, source) {
    await db_1.default.importedEvent.deleteMany({ where: { userId, source } });
}
// ── Router ────────────────────────────────────────────────────────────────────
function createImportedEventsRouter() {
    const router = express_1.default.Router();
    // ── GET /api/imported-events ─────────────────────────────────────────────
    router.get("/", async (req, res) => {
        const userId = Number(req.query.userId);
        if (!userId)
            return res.status(400).json({ message: "userId required" });
        try {
            const events = await db_1.default.importedEvent.findMany({
                where: { userId },
                orderBy: [{ date: "asc" }, { startHour: "asc" }],
            });
            return res.json({ success: true, events });
        }
        catch (err) {
            console.error("Get imported events error:", err);
            return res
                .status(500)
                .json({ message: "Failed to fetch imported events" });
        }
    });
    // ── PATCH /api/imported-events/:id/location ──────────────────────────────
    router.patch("/:id/location", async (req, res) => {
        const id = Number(req.params.id);
        const userId = Number(req.body.userId || req.headers["x-user-id"]);
        const { locationOverride } = req.body;
        if (!id || !userId) {
            return res.status(400).json({ message: "id and userId required" });
        }
        if (typeof locationOverride !== "string" && locationOverride !== null) {
            return res
                .status(400)
                .json({ message: "locationOverride must be a string or null" });
        }
        try {
            const existing = await db_1.default.importedEvent.findUnique({
                where: { id },
            });
            if (!existing || existing.userId !== userId) {
                return res.status(404).json({ message: "Event not found" });
            }
            const updated = await db_1.default.importedEvent.update({
                where: { id },
                data: { locationOverride: locationOverride?.trim() || null },
            });
            return res.json({ success: true, event: updated });
        }
        catch (err) {
            console.error("Update location override error:", err);
            return res.status(500).json({ message: "Failed to update location" });
        }
    });
    return router;
}
