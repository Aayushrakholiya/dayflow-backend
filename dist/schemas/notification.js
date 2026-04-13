"use strict";
/*
*  FILE          : notification.ts
*  PROJECT       : PROG3221 - capstone
*  PROGRAMMER    : Ayushkumar Rakholiya, Jal Shah, Darsh Patel and Virajsinh Solanki
*  FIRST VERSION : 2026-02-01
*  DESCRIPTION   :
*    Zod validation schemas for notification API endpoints.
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeleteNotificationSchema = exports.MarkAsReadSchema = exports.GetUnreadNotificationsSchema = exports.NotificationType = void 0;
const zod_1 = require("zod");
// Notification type enum
exports.NotificationType = zod_1.z.enum([
    "EVENT_CREATED",
    "EVENT_UPDATED",
    "EVENT_DELETED",
    "TASK_CREATED",
    "TASK_DELETED",
    "CONFLICT_WARNING",
]);
// Get unread notifications
exports.GetUnreadNotificationsSchema = zod_1.z.object({
    params: zod_1.z.object({
        userId: zod_1.z.string().transform(Number).pipe(zod_1.z.number().positive("User ID must be positive")),
    }),
});
// Mark notification as read
exports.MarkAsReadSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().transform(Number).pipe(zod_1.z.number().positive("Notification ID must be positive")),
    }),
});
// Delete notification
exports.DeleteNotificationSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().transform(Number).pipe(zod_1.z.number().positive("Notification ID must be positive")),
    }),
});
