"use strict";
/*
*  FILE          : notifications.ts
*  PROJECT       : PROG3221 - capstone
*  PROGRAMMER    : Ayushkumar Rakholiya, Jal Shah, Darsh Patel and Virajsinh Solanki
*  FIRST VERSION : 2026-02-01
*  DESCRIPTION   :
*    Routes for getting, marking, and deleting user notifications.
*/
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("./middleware/auth");
const errors_1 = require("./middleware/errors");
const notificationService_1 = require("./services/notificationService");
const notification_1 = require("./schemas/notification");
const router = express_1.default.Router();
// Returns all unread notifications for a given user
router.get("/:userId/unread", auth_1.authMiddleware, (0, errors_1.asyncHandler)(async (req, res) => {
    const validatedData = notification_1.GetUnreadNotificationsSchema.parse({ params: req.params });
    const userId = validatedData.params.userId;
    const notifications = await notificationService_1.notificationService.getUnreadNotifications(userId);
    res.json(notifications);
}));
// Marks a single notification as read by ID
router.patch("/:id/read", (0, errors_1.asyncHandler)(async (req, res) => {
    const validatedData = notification_1.MarkAsReadSchema.parse({ params: req.params });
    const id = validatedData.params.id;
    const notification = await notificationService_1.notificationService.markAsRead(id);
    res.json(notification);
}));
// Deletes a notification by ID
router.delete("/:id", (0, errors_1.asyncHandler)(async (req, res) => {
    const validatedData = notification_1.DeleteNotificationSchema.parse({ params: req.params });
    const id = validatedData.params.id;
    await notificationService_1.notificationService.deleteNotification(id);
    res.json({ message: "Notification deleted" });
}));
// Error handling middleware — must stay at the end
router.use(errors_1.errorHandler);
exports.default = router;
