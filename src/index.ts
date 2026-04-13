/*  
*  FILE          : index.ts 
*  PROJECT       : PROG3221 - capstone
*  PROGRAMMER    : Ayushkumar Rakholiya, Jal Shah, Darsh Patel and Virajsinh Solanki 
*  FIRST VERSION : 2026-02-01 
*  DESCRIPTION   : 
*    Main server entry point initializing Express app, routes, WebSocket, and background jobs.
*/ 

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import path from "path";
dotenv.config();

import createSignupRouter from "./signup";
import createLoginRouter from "./login";
import createUserProfileRouter from "./userProfile";
import { registerPasswordResetRoutes } from "./passwordReset";
import { registerEventInviteRoutes } from "./Eventinvite";
import createEventsRouter from "./events";
import createTasksRouter from "./tasks";
import createLocationRouter from "./location";
import createWeatherRouter from "./weather";
import notificationsRouter from "./notifications";
import usersRouter from "./users";
import { runAllNotificationJobs } from "./smartEventNotifications";
import prisma from "./db";
import { errorHandler } from "./middleware/errors";
import { logger } from "./lib/logging";

// ── Imported calendar routes ──────────────────────────────────────────────────
import createGoogleCalendarRouter from "./googlecalendar";
import createMicrosoftCalendarRouter from "./microsoftcalendar";
import { createImportedEventsRouter } from "./Importedevents";

const app = express();
const httpServer = createServer(app);

app.use(cors());
app.use(express.json());

// ── Serve frontend static files in production ─────────────────────────────────
const frontendPath = path.join(__dirname, "../../frontend/dist");
app.use(express.static(frontendPath));

app.get("/", (req, res) => {
  res.json({ message: "Server is running!" });
});
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");
  next();
});

// ── Auth ──────────────────────────────────────────────────────────────────────
app.use("/api/auth", createSignupRouter());
app.use("/api/auth", createLoginRouter());
app.use("/api/auth", createUserProfileRouter());
registerPasswordResetRoutes(app);

// ── Own events + tasks ────────────────────────────────────────────────────────
app.use("/api/events", createEventsRouter());
app.use("/api/tasks", createTasksRouter());

// ── Event invite emails (must be after /api/events router) ───────────────────
registerEventInviteRoutes(app);

// ── Location + weather ────────────────────────────────────────────────────────
app.use("/api/location", createLocationRouter());
app.use("/api", createWeatherRouter());

// ── Notifications ─────────────────────────────────────────────────────────────

app.use("/api/notifications", notificationsRouter);
app.use("/api/users", usersRouter);

// ── External calendar integrations ───────────────────────────────────────────
app.use("/api/google-calendar", createGoogleCalendarRouter());
app.use("/api/microsoft-calendar", createMicrosoftCalendarRouter());
app.use("/api/imported-events", createImportedEventsRouter());

// ── Serve React SPA fallback for client-side routing ──────────────────────────
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    return next();
  }
  res.sendFile(path.join(frontendPath, "index.html"));
});

// ── 404 handler for API routes ────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    message: "Route not found",
    path: req.path,
    method: req.method,
  });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use(errorHandler);

httpServer.listen(4000, () => {
  logger.info("Server started", { port: 4000 });
  console.log("✅ Server running on http://localhost:4000");
  console.log("Login: POST http://localhost:4000/api/auth/login");

  // ── Run notification job immediately on startup ────────────────────────────
  runAllNotificationJobs().catch(err => {
    logger.error("Error in initial notification job run", { error: err });
  });

  // ── Start smart event notification job (every minute) ────────────────────────
  setInterval(async () => {
    try {
      await runAllNotificationJobs();
    } catch (error) {
      logger.error("Error in notification job", { error });
    }
  }, 60 * 1000); // Run every 60 seconds

  logger.info("Smart event notification job started", { interval: "60 seconds" });
});
