/*  
*  FILE          : events.ts 
*  PROJECT       : PROG3221 - capstone
*  PROGRAMMER    : Ayushkumar Rakholiya, Jal Shah, Darsh Patel and Virajsinh Solanki 
*  FIRST VERSION : 2026-02-01 
*  DESCRIPTION   : 
*    Handles CRUD routes for calendar events with conflict detection and notifications.
*/ 

import express, { Request, Response, NextFunction } from "express";
import prisma from "./db";
import {
  createEventCreatedNotification,
  createEventDeletedNotification,
  createEventUpdatedNotification,
} from "./services/notificationService";

// Extend Express Request to include userId
interface AuthRequest extends Request {
  userId?: string | number;
}

//----------------------------------
function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}
//----------------------------------

export default function createEventsRouter() {
  const router = express.Router();

  // Middleware: Verify user
  const verifyUser = (req: AuthRequest, res: Response, next: NextFunction) => {
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
          date: new Date(date || Date.now()),
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

      await createEventCreatedNotification(event);

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

      const eventId = parseInt(id);


      const event = await prisma.event.update({
        where: { id: parseInt(id) },
        data: {
          title,
          date: new Date(date || Date.now()),
          startHour,
          endHour,
          attendees: attendees || [],
          location: location || null,
          description: description || null,
          videoconferencing: videoconferencing || null,
          color: color || null,
        },
      });

      await createEventUpdatedNotification(event);

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
      const eventId = parseInt(id);

      const existingEvent = await prisma.event.findUnique({
      where: { id: eventId },
      });

    if (!existingEvent) {
      return res.status(404).json({ message: "Event not found" });
    }

      await prisma.event.delete({
        where: { id: parseInt(id) },
      });

      await createEventDeletedNotification({
      userId: existingEvent.userId,
      title: existingEvent.title,
      startHour: existingEvent.startHour,
    });

      return res.status(200).json({ success: true, message: "Event deleted" });
    } catch (error) {
      console.error("Delete event error:", error);
      return res.status(500).json({ message: "Failed to delete event" });
    }
  });

  return router;
}
