"use strict";
/*
*  FILE          : index.ts
*  PROJECT       : PROG3221 - capstone
*  PROGRAMMER    : Ayushkumar Rakholiya, Jal Shah, Darsh Patel and Virajsinh Solanki
*  FIRST VERSION : 2026-02-01
*  DESCRIPTION   :
*    Main server entry point initializing Express app, routes, WebSocket, and background jobs.
*/
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const http_1 = require("http");
const path_1 = __importDefault(require("path"));
dotenv_1.default.config();
const signup_1 = __importDefault(require("./signup"));
const login_1 = __importDefault(require("./login"));
const userProfile_1 = __importDefault(require("./userProfile"));
const passwordReset_1 = require("./passwordReset");
const Eventinvite_1 = require("./Eventinvite");
const events_1 = __importDefault(require("./events"));
const tasks_1 = __importDefault(require("./tasks"));
const location_1 = __importDefault(require("./location"));
const weather_1 = __importDefault(require("./weather"));
const notifications_1 = __importDefault(require("./notifications"));
const users_1 = __importDefault(require("./users"));
const smartEventNotifications_1 = require("./smartEventNotifications");
const errors_1 = require("./middleware/errors");
const logging_1 = require("./lib/logging");
// ── Imported calendar routes ──────────────────────────────────────────────────
const googlecalendar_1 = __importDefault(require("./googlecalendar"));
const microsoftcalendar_1 = __importDefault(require("./microsoftcalendar"));
const Importedevents_1 = require("./Importedevents");
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// ── Serve frontend static files in production ─────────────────────────────────
const frontendPath = path_1.default.join(__dirname, "../../frontend/dist");
app.use(express_1.default.static(frontendPath));
app.get("/", (req, res) => {
    res.json({ message: "Server is running!" });
});
app.use((req, res, next) => {
    res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");
    next();
});
// ── Auth ──────────────────────────────────────────────────────────────────────
app.use("/api/auth", (0, signup_1.default)());
app.use("/api/auth", (0, login_1.default)());
app.use("/api/auth", (0, userProfile_1.default)());
(0, passwordReset_1.registerPasswordResetRoutes)(app);
// ── Own events + tasks ────────────────────────────────────────────────────────
app.use("/api/events", (0, events_1.default)());
app.use("/api/tasks", (0, tasks_1.default)());
// ── Event invite emails (must be after /api/events router) ───────────────────
(0, Eventinvite_1.registerEventInviteRoutes)(app);
// ── Location + weather ────────────────────────────────────────────────────────
app.use("/api/location", (0, location_1.default)());
app.use("/api", (0, weather_1.default)());
// ── Notifications ─────────────────────────────────────────────────────────────
app.use("/api/notifications", notifications_1.default);
app.use("/api/users", users_1.default);
// ── External calendar integrations ───────────────────────────────────────────
app.use("/api/google-calendar", (0, googlecalendar_1.default)());
app.use("/api/microsoft-calendar", (0, microsoftcalendar_1.default)());
app.use("/api/imported-events", (0, Importedevents_1.createImportedEventsRouter)());
// ── Serve React SPA fallback for client-side routing ──────────────────────────
app.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
        return next();
    }
    res.sendFile(path_1.default.join(frontendPath, "index.html"));
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
app.use(errors_1.errorHandler);
httpServer.listen(4000, () => {
    logging_1.logger.info("Server started", { port: 4000 });
    console.log("✅ Server running on http://localhost:4000");
    console.log("Login: POST http://localhost:4000/api/auth/login");
    // ── Run notification job immediately on startup ────────────────────────────
    (0, smartEventNotifications_1.runAllNotificationJobs)().catch(err => {
        logging_1.logger.error("Error in initial notification job run", { error: err });
    });
    // ── Start smart event notification job (every minute) ────────────────────────
    setInterval(async () => {
        try {
            await (0, smartEventNotifications_1.runAllNotificationJobs)();
        }
        catch (error) {
            logging_1.logger.error("Error in notification job", { error });
        }
    }, 60 * 1000); // Run every 60 seconds
    logging_1.logger.info("Smart event notification job started", { interval: "60 seconds" });
});
