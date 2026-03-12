"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const signup_1 = __importDefault(require("./signup"));
const login_1 = __importDefault(require("./login"));
const userProfile_1 = __importDefault(require("./userProfile"));
const passwordReset_1 = require("./passwordReset");
const events_1 = __importDefault(require("./events"));
const tasks_1 = __importDefault(require("./tasks"));
const location_1 = __importDefault(require("./location"));
const weather_1 = __importDefault(require("./weather"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Debug middleware - log all requests
app.use((_req, _res, next) => {
    console.log(`${_req.method} ${_req.path}`);
    next();
});
// Test route to verify server is running
app.get("/", (_req, res) => {
    res.json({ message: "Server is running!" });
});
// Mount routers at /api/auth base path
app.use("/api/auth", (0, signup_1.default)());
app.use("/api/auth", (0, login_1.default)());
app.use("/api/auth", (0, userProfile_1.default)());
// Register password reset routes (forgot-password, verify-otp, reset-password)
(0, passwordReset_1.registerPasswordResetRoutes)(app);
// Register events and tasks routes
app.use("/api/events", (0, events_1.default)());
app.use("/api/tasks", (0, tasks_1.default)());
app.use("/api/location", (0, location_1.default)());
app.use("/api", (0, weather_1.default)());
// 404 handler - helps debug missing routes
app.use((req, res) => {
    console.log(`404 - Route not found: ${req.method} ${req.path}`);
    res.status(404).json({
        message: "Route not found",
        path: req.path,
        method: req.method,
    });
});
app.listen(4000, () => {
    console.log("Server running on http://localhost:4000");
    console.log("Login: POST http://localhost:4000/api/auth/login");
});
