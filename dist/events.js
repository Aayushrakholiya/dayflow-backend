"use strict";
/*
*  FILE          : events.ts
*  PROJECT       : PROG3221 - capstone
*  PROGRAMMER    : Ayushkumar Rakholiya, Jal Shah, Darsh Patel and Virajsinh Solanki
*  FIRST VERSION : 2026-02-01
*  DESCRIPTION   :
*    Handles CRUD routes for calendar events with conflict detection and notifications.
*/
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = createEventsRouter;
const express_1 = __importDefault(require("express"));
const db_1 = __importDefault(require("./db"));
const notificationService_1 = require("./services/notificationService");
//----------------------------------
function parseLocalDate(dateString) {
    const [year, month, day] = dateString.split("-").map(Number);
    return new Date(year, month - 1, day, 12, 0, 0, 0);
}
//----------------------------------
function createEventsRouter() {
    const router = express_1.default.Router();
    // Middleware: Verify user
    const verifyUser = (req, res, next) => {
        req.userId = (req.body?.userId || req.headers["x-user-id"]);
        next();
    };
    router.use(verifyUser);
    // CREATE event
    router.post("/create", async (req, res) => {
        try {
            const { title, date, startHour, endHour, attendees, location, description, videoconferencing, color, userId, } = req.body;
            const parsedUserId = Number(userId);
            if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
                return res.status(400).json({ message: "Invalid userId" });
            }
            const event = await db_1.default.event.create({
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
            await (0, notificationService_1.createEventCreatedNotification)(event);
            return res.status(201).json({ success: true, event });
        }
        catch (error) {
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
            const event = await db_1.default.event.update({
                where: { id: parseInt(id) },
                data: { completed: true, completedAt: new Date() },
            });
            res.json({ event });
        }
        catch (error) {
            console.error("Complete event error:", error);
            res.status(500).json({ error: "Failed to mark event complete" });
        }
    });
    // GET all events for user
    router.get("/", async (req, res) => {
        try {
            const rawUserId = req.query.userId || req.userId;
            if (rawUserId === undefined || rawUserId === null || rawUserId === "") {
                return res.status(400).json({ message: "userId is required" });
            }
            const parsedUserId = Number(rawUserId);
            if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
                return res.status(400).json({ message: "Invalid userId" });
            }
            const events = await db_1.default.event.findMany({
                where: { userId: parsedUserId },
                orderBy: { date: "asc" },
            });
            return res.status(200).json({ success: true, events });
        }
        catch (error) {
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
            const { title, date, startHour, endHour, attendees, location, description, videoconferencing, color, } = req.body;
            const eventId = parseInt(id);
            const event = await db_1.default.event.update({
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
            await (0, notificationService_1.createEventUpdatedNotification)(event);
            return res.status(200).json({ success: true, event });
        }
        catch (error) {
            console.error("Update event error:", error);
            return res.status(500).json({ message: "Failed to update event" });
        }
    });
    // DELETE event
    router.delete("/:id", async (req, res) => {
        try {
            const { id } = req.params;
            const eventId = parseInt(id);
            const existingEvent = await db_1.default.event.findUnique({
                where: { id: eventId },
            });
            if (!existingEvent) {
                return res.status(404).json({ message: "Event not found" });
            }
            await db_1.default.event.delete({
                where: { id: parseInt(id) },
            });
            await (0, notificationService_1.createEventDeletedNotification)({
                userId: existingEvent.userId,
                title: existingEvent.title,
                startHour: existingEvent.startHour,
            });
            return res.status(200).json({ success: true, message: "Event deleted" });
        }
        catch (error) {
            console.error("Delete event error:", error);
            return res.status(500).json({ message: "Failed to delete event" });
        }
    });
    return router;
}
