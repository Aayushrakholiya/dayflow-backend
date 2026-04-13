"use strict";
/*
*  FILE          : tasks.ts
*  PROJECT       : PROG3221 - capstone
*  PROGRAMMER    : Ayushkumar Rakholiya, Jal Shah, Darsh Patel and Virajsinh Solanki
*  FIRST VERSION : 2026-02-01
*  DESCRIPTION   :
*    CRUD routes for tasks with notifications on create and delete.
*/
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = createTasksRouter;
const express_1 = __importDefault(require("express"));
const db_1 = __importDefault(require("./db"));
const notificationService_1 = require("./services/notificationService");
//-----------------------------------
function parseLocalDate(dateString) {
    const [year, month, day] = dateString.split("-").map(Number);
    return new Date(year, month - 1, day);
}
//----------------------------------- 
function createTasksRouter() {
    const router = express_1.default.Router();
    // Middleware: Verify user
    const verifyUser = (req, res, next) => {
        req.userId = (req.body?.userId || req.headers["x-user-id"]);
        next();
    };
    router.use(verifyUser);
    // CREATE task
    router.post("/create", async (req, res) => {
        try {
            const { title, dueDate, startHour, endHour, durationMinutes, color, userId } = req.body;
            const task = await db_1.default.task.create({
                data: {
                    title,
                    dueDate: new Date(dueDate || Date.now()),
                    startHour,
                    endHour,
                    durationMinutes,
                    color: color,
                    userId: parseInt(userId),
                },
            });
            await (0, notificationService_1.createTaskCreatedNotification)(task);
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
            const tasks = await db_1.default.task.findMany({
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
            const taskId = parseInt(id);
            const task = await db_1.default.task.update({
                where: { id: parseInt(id) },
                data: {
                    title,
                    dueDate: new Date(dueDate || Date.now()),
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
            const taskId = parseInt(id);
            const existingTask = await db_1.default.task.findUnique({
                where: { id: taskId },
            });
            if (!existingTask) {
                return res.status(404).json({ message: "Task not found" });
            }
            await db_1.default.task.delete({
                where: { id: parseInt(id) },
            });
            await (0, notificationService_1.createTaskDeletedNotification)({
                userId: existingTask.userId,
                title: existingTask.title,
                startHour: existingTask.startHour,
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
