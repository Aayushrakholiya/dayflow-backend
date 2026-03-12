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

export default function createTasksRouter() {
  const router = express.Router();

  // Middleware: Verify user
  const verifyUser = (req: AuthRequest, _res: Response, next: NextFunction) => {
    req.userId = (req.body?.userId || req.headers["x-user-id"]) as string | number | undefined;
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
    } catch (error) {
      console.error("Create task error:", error);
      return res.status(500).json({ message: "Failed to create task" });
    }
  });

  // GET all tasks for user
  router.get("/", async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.query.userId || req.userId;

      const tasks = await prisma.task.findMany({
        where: { userId: parseInt(userId as string) },
        orderBy: { dueDate: "asc" },
      });

      return res.status(200).json({ success: true, tasks });
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
      console.error("Delete task error:", error);
      return res.status(500).json({ message: "Failed to delete task" });
    }
  });

  return router;
}
