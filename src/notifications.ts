/*  
*  FILE          : notifications.ts 
*  PROJECT       : PROG3221 - capstone
*  PROGRAMMER    : Ayushkumar Rakholiya, Jal Shah, Darsh Patel and Virajsinh Solanki 
*  FIRST VERSION : 2026-02-01 
*  DESCRIPTION   : 
*    Routes for getting, marking, and deleting user notifications.
*/ 

import express, { Request, Response } from "express";
import { authMiddleware } from "./middleware/auth";
import { errorHandler, asyncHandler } from "./middleware/errors";
import { notificationService } from "./services/notificationService";
import {
  GetUnreadNotificationsSchema,
  MarkAsReadSchema,
  DeleteNotificationSchema,
} from "./schemas/notification";

const router = express.Router();

// Returns all unread notifications for a given user
router.get(
  "/:userId/unread",
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const validatedData = GetUnreadNotificationsSchema.parse({ params: req.params });
    const userId = validatedData.params.userId;

    const notifications = await notificationService.getUnreadNotifications(userId);
    res.json(notifications);
  })
);

// Marks a single notification as read by ID
router.patch(
  "/:id/read",
  asyncHandler(async (req: Request, res: Response) => {
    const validatedData = MarkAsReadSchema.parse({ params: req.params });
    const id = validatedData.params.id;

    const notification = await notificationService.markAsRead(id);
    res.json(notification);
  })
);

// Deletes a notification by ID
router.delete(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const validatedData = DeleteNotificationSchema.parse({ params: req.params });
    const id = validatedData.params.id;

    await notificationService.deleteNotification(id);
    res.json({ message: "Notification deleted" });
  })
);

// Error handling middleware — must stay at the end
router.use(errorHandler);

export default router;