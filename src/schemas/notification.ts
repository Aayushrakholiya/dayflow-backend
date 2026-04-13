/*  
*  FILE          : notification.ts 
*  PROJECT       : PROG3221 - capstone
*  PROGRAMMER    : Ayushkumar Rakholiya, Jal Shah, Darsh Patel and Virajsinh Solanki 
*  FIRST VERSION : 2026-02-01 
*  DESCRIPTION   : 
*    Zod validation schemas for notification API endpoints.
*/ 

import { z } from "zod";

// Notification type enum
export const NotificationType = z.enum([
  "EVENT_CREATED",
  "EVENT_UPDATED",
  "EVENT_DELETED",
  "TASK_CREATED",
  "TASK_DELETED",
  "CONFLICT_WARNING",
]);

// Get unread notifications
export const GetUnreadNotificationsSchema = z.object({
  params: z.object({
    userId: z.string().transform(Number).pipe(z.number().positive("User ID must be positive")),
  }),
});

// Mark notification as read
export const MarkAsReadSchema = z.object({
  params: z.object({
    id: z.string().transform(Number).pipe(z.number().positive("Notification ID must be positive")),
  }),
});

// Delete notification
export const DeleteNotificationSchema = z.object({
  params: z.object({
    id: z.string().transform(Number).pipe(z.number().positive("Notification ID must be positive")),
  }),
});

export type GetUnreadNotificationsInput = z.infer<typeof GetUnreadNotificationsSchema>;
export type MarkAsReadInput = z.infer<typeof MarkAsReadSchema>;
export type DeleteNotificationInput = z.infer<typeof DeleteNotificationSchema>;
