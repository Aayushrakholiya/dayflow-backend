"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = createTasksRouter;
const node_process_1 = __importDefault(require("node:process"));
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = __importDefault(require("pg"));
// Create PostgreSQL pool
const pool = new pg_1.default.Pool({
    connectionString: node_process_1.default.env.DATABASE_URL,
});
// Create adapter
const adapter = new adapter_pg_1.PrismaPg(pool);
// Initialize PrismaClient with adapter
const prisma = new client_1.PrismaClient({ adapter });
function createTasksRouter() {
    const router = express_1.default.Router();
    // Middleware: Verify user
    const verifyUser = (req, _res, next) => {
        req.userId = (req.body?.userId || req.headers["x-user-id"]);
        next();
    };
    router.use(verifyUser);
    // CREATE task
    router.post("/create", async (req, res) => {
        try {
            const { title, dueDate, startHour, endHour, durationMinutes, color, userId } = req.body;
            const task = await prisma.task.create({
                data: {
                    title,
                    dueDate: new Date(dueDate),
                    startHour,
                    endHour,
                    durationMinutes,
                    color: color,
                    userId: parseInt(userId),
                },
            });
            return res.status(201).json({ success: true, task });
        }
        catch (error) {
            console.error("Create task error:", error);
            return res.status(500).json({ message: "Failed to create task" });
        }
    });
    // GET all tasks for user
    router.get("/", async (req, res) => {
        try {
            const userId = req.query.userId || req.userId;
            const tasks = await prisma.task.findMany({
                where: { userId: parseInt(userId) },
                orderBy: { dueDate: "asc" },
            });
            return res.status(200).json({ success: true, tasks });
        }
        catch (error) {
            console.error("Get tasks error:", error);
            return res.status(500).json({ message: "Failed to fetch tasks" });
        }
    });
    // UPDATE task
    router.put("/:id", async (req, res) => {
        try {
            const { id } = req.params;
            const { title, dueDate, startHour, endHour, durationMinutes, color } = req.body;
            const task = await prisma.task.update({
                where: { id: parseInt(id) },
                data: {
                    title,
                    dueDate: new Date(dueDate),
                    startHour,
                    endHour,
                    durationMinutes,
                    color: color,
                },
            });
            return res.status(200).json({ success: true, task });
        }
        catch (error) {
            console.error("Update task error:", error);
            return res.status(500).json({ message: "Failed to update task" });
        }
    });
    // DELETE task
    router.delete("/:id", async (req, res) => {
        try {
            const { id } = req.params;
            await prisma.task.delete({
                where: { id: parseInt(id) },
            });
            return res.status(200).json({ success: true, message: "Task deleted" });
        }
        catch (error) {
            console.error("Delete task error:", error);
            return res.status(500).json({ message: "Failed to delete task" });
        }
    });
    return router;
}
