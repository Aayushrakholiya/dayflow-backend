import process from "node:process";
import express, { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

// Create PostgreSQL pool
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create adapter
const adapter = new PrismaPg(pool);

// Initialize PrismaClient with adapter
const prisma = new PrismaClient({ adapter });

// Extend Express Request to include userId
interface AuthRequest extends Request {
  userId?: string | number;
}

export default function createEventsRouter() {
  const router = express.Router();

  // Middleware: Verify user
  const verifyUser = (req: AuthRequest, _res: Response, next: NextFunction) => {
    req.userId = (req.body?.userId || req.headers["x-user-id"]) as
      | string
      | number
      | undefined;
    next();
  };

  router.use(verifyUser);

  // CREATE event
  router.post("/create", async (req, res) => {
    try {
      const {
        title,
        date,
        startHour,
        endHour,
        attendees,
        location,
        description,
        videoconferencing,
        color,
        userId,
      } = req.body;
      const parsedUserId = Number(userId);

      if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
        return res.status(400).json({ message: "Invalid userId" });
      }
      const event = await prisma.event.create({
        data: {
          title,
          date: new Date(date),
          startHour,
          endHour,
          attendees: attendees || [],
          location: location || null,
          description: description || null,
          videoconferencing: videoconferencing || null,
          color: color || null,
          userId: parsedUserId,
        },
      });

      return res.status(201).json({ success: true, event });
    } catch (error) {
      console.error("Create event error:", error);
      return res.status(500).json({
        message: "Failed to create event",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });
  router.patch("/:id/complete", async (req, res) => {
    try {
      const { id } = req.params;
      const event = await prisma.event.update({
        where: { id: parseInt(id) },
        data: { completed: true, completedAt: new Date() },
      });
      res.json({ event });
    } catch (error) {
      console.error("Complete event error:", error);
      res.status(500).json({ error: "Failed to mark event complete" });
    }
  });
  // GET all events for user
  router.get("/", async (req: AuthRequest, res: Response) => {
    try {
      const rawUserId = req.query.userId || req.userId;

      if (rawUserId === undefined || rawUserId === null || rawUserId === "") {
        return res.status(400).json({ message: "userId is required" });
      }

      const parsedUserId = Number(rawUserId);

      if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
        return res.status(400).json({ message: "Invalid userId" });
      }

      const events = await prisma.event.findMany({
        where: { userId: parsedUserId },
        orderBy: { date: "asc" },
      });

      return res.status(200).json({ success: true, events });
    } catch (error) {
      console.error("Get events error:", error);
      return res.status(500).json({
        message: "Failed to fetch events",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // UPDATE event
  router.put("/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const {
        title,
        date,
        startHour,
        endHour,
        attendees,
        location,
        description,
        videoconferencing,
        color,
      } = req.body;

      const event = await prisma.event.update({
        where: { id: parseInt(id) },
        data: {
          title,
          date: new Date(date),
          startHour,
          endHour,
          attendees: attendees || [],
          location: location || null,
          description: description || null,
          videoconferencing: videoconferencing || null,
          color: color || null,
        },
      });

      return res.status(200).json({ success: true, event });
    } catch (error) {
      console.error("Update event error:", error);
      return res.status(500).json({ message: "Failed to update event" });
    }
  });

  // DELETE event
  router.delete("/:id", async (req, res) => {
    try {
      const { id } = req.params;

      await prisma.event.delete({
        where: { id: parseInt(id) },
      });

      return res.status(200).json({ success: true, message: "Event deleted" });
    } catch (error) {
      console.error("Delete event error:", error);
      return res.status(500).json({ message: "Failed to delete event" });
    }
  });

  return router;
}
