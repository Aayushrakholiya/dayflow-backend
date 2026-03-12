import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

import createSignupRouter from "./signup";
import createLoginRouter from "./login";
import createUserProfileRouter from "./userProfile";
import { registerPasswordResetRoutes } from "./passwordReset";
import createEventsRouter from "./events";
import createTasksRouter from "./tasks";
import createLocationRouter from "./location"; 
import createWeatherRouter from "./weather";
const app = express();

app.use(cors());
app.use(express.json());

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
app.use("/api/auth", createSignupRouter());
app.use("/api/auth", createLoginRouter());
app.use("/api/auth", createUserProfileRouter());

// Register password reset routes (forgot-password, verify-otp, reset-password)
registerPasswordResetRoutes(app);

// Register events and tasks routes
app.use("/api/events", createEventsRouter());
app.use("/api/tasks", createTasksRouter());
app.use("/api/location", createLocationRouter()); 
app.use("/api", createWeatherRouter());

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
