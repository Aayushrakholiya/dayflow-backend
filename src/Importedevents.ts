/*  
*  FILE          : Importedevents.ts 
*  PROJECT       : PROG3221 - capstone
*  PROGRAMMER    : Ayushkumar Rakholiya, Jal Shah, Darsh Patel and Virajsinh Solanki 
*  FIRST VERSION : 2026-02-01 
*  DESCRIPTION   : 
*    Manages imported events from Google and Microsoft calendars with upsert and deletion.
*/ 

import express, { Request, Response } from "express";

// ── Prisma (shared singleton) ────────────────────────────────────────────────
import prisma from "./db";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ImportedEventPayload {
  externalId: string;
  source: "google" | "microsoft";
  title: string;
  date: Date;
  startHour: number;
  endHour: number;
  location?: string | null;
  description?: string | null;
  attendees: string[];
  videoconferencing?: string | null;
  color: string;
  calendarName: string;
}

// ── Write helpers ─────────────────────────────────────────────────────────────

const CHUNK_SIZE = 50;

export async function upsertImportedEvents(
  userId: number,
  events: ImportedEventPayload[],
): Promise<void> {
  const source = events[0]?.source;

  if (source) {
    const incomingIds = new Set(events.map((ev) => ev.externalId));

    const existing = await (prisma as any).importedEvent.findMany({
      where: { userId, source },
      select: { id: true, externalId: true },
    });

    const toDelete = existing
      .filter(
        (row: { id: number; externalId: string }) =>
          !incomingIds.has(row.externalId),
      )
      .map((row: { id: number; externalId: string }) => row.id);

    if (toDelete.length > 0) {
      await (prisma as any).importedEvent.deleteMany({
        where: { id: { in: toDelete } },
      });
    }
  }

  if (!events.length) return;

  // ── Step 2: Upsert all incoming events ────────────────────────────────────
  // Process in chunks of 50 to avoid transaction timeouts on large calendars
  for (let i = 0; i < events.length; i += CHUNK_SIZE) {
    const chunk = events.slice(i, i + CHUNK_SIZE);
    await prisma.$transaction(
      chunk.map((ev) =>
        (prisma as any).importedEvent.upsert({
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
        }),
      ),
    );
  }
}

export async function deleteImportedEventsBySource(
  userId: number,
  source: "google" | "microsoft",
): Promise<void> {
  await (prisma as any).importedEvent.deleteMany({ where: { userId, source } });
}

// ── Router ────────────────────────────────────────────────────────────────────

export function createImportedEventsRouter() {
  const router = express.Router();

  // ── GET /api/imported-events ─────────────────────────────────────────────
  router.get("/", async (req: Request, res: Response) => {
    const userId = Number(req.query.userId);
    if (!userId) return res.status(400).json({ message: "userId required" });

    try {
      const events = await (prisma as any).importedEvent.findMany({
        where: { userId },
        orderBy: [{ date: "asc" }, { startHour: "asc" }],
      });
      return res.json({ success: true, events });
    } catch (err) {
      console.error("Get imported events error:", err);
      return res
        .status(500)
        .json({ message: "Failed to fetch imported events" });
    }
  });

  // ── PATCH /api/imported-events/:id/location ──────────────────────────────
  router.patch("/:id/location", async (req: Request, res: Response) => {
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
      const existing = await (prisma as any).importedEvent.findUnique({
        where: { id },
      });
      if (!existing || existing.userId !== userId) {
        return res.status(404).json({ message: "Event not found" });
      }

      const updated = await (prisma as any).importedEvent.update({
        where: { id },
        data: { locationOverride: locationOverride?.trim() || null },
      });
      return res.json({ success: true, event: updated });
    } catch (err) {
      console.error("Update location override error:", err);
      return res.status(500).json({ message: "Failed to update location" });
    }
  });

  return router;
}