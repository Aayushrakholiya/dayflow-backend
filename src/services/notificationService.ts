/*  
*  FILE          : notificationService.ts 
*  PROJECT       : PROG3221 - capstone
*  PROGRAMMER    : Ayushkumar Rakholiya, Jal Shah, Darsh Patel and Virajsinh Solanki 
*  FIRST VERSION : 2026-02-01 
*  DESCRIPTION   : 
*    Notification service layer for storing and retrieving notifications from database.
*/ 

import prisma from "../db";
import { logger } from "../lib/logging";

/**
 * Notification Service Layer
 * Stores event/task notifications for frontend to display via react-toastify
 */

export class NotificationService {
  /**
   * Create EVENT_CREATED notification (stored in DB only)
   */
  async createEventCreatedNotification(event: any) {
    try {
      await prisma.notification.create({
        data: {
          userId: event.userId,
          type: "EVENT_CREATED",
          title: "Event Created",
          message: `"${event.title}" has been created`,
          eventId: event.id,
          scheduledTime: new Date(),
          isSent: true,
          sentAt: new Date(),
          isRead: false,
        },
      });

      logger.info("EVENT_CREATED notification saved", {
        userId: event.userId,
        eventId: event.id,
      });
    } catch (error) {
      logger.error("Error creating EVENT_CREATED notification", { error });
    }
  }

  /**
   * Create EVENT_UPDATED notification (stored in DB only)
   */
  async createEventUpdatedNotification(event: any) {
    try {
      await prisma.notification.create({
        data: {
          userId: event.userId,
          type: "EVENT_UPDATED",
          title: "Event Updated",
          message: `"${event.title}" has been updated`,
          eventId: event.id,
          scheduledTime: new Date(),
          isSent: true,
          sentAt: new Date(),
          isRead: false,
        },
      });

      logger.info("EVENT_UPDATED notification saved", {
        userId: event.userId,
        eventId: event.id,
      });
    } catch (error) {
      logger.error("Error creating EVENT_UPDATED notification", { error });
    }
  }

  /**
   * Create EVENT_DELETED notification (stored in DB only)
   */
  async createEventDeletedNotification(data: any) {
    try {
      await prisma.notification.create({
        data: {
          userId: data.userId,
          type: "EVENT_DELETED",
          title: "Event Deleted",
          message: `"${data.title}" has been deleted`,
          eventId: data.id,
          scheduledTime: new Date(),
          isSent: true,
          sentAt: new Date(),
          isRead: false,
        },
      });

      logger.info("EVENT_DELETED notification saved", {
        userId: data.userId,
        eventId: data.id,
      });
    } catch (error) {
      logger.error("Error creating EVENT_DELETED notification", { error });
    }
  }

  /**
   * Create TASK_CREATED notification (stored in DB only)
   */
  async createTaskCreatedNotification(task: any) {
    try {
      await prisma.notification.create({
        data: {
          userId: task.userId,
          type: "TASK_CREATED",
          title: "Task Created",
          message: `"${task.title}" has been created`,
          taskId: task.id,
          scheduledTime: new Date(),
          isSent: true,
          sentAt: new Date(),
          isRead: false,
        },
      });

      logger.info("TASK_CREATED notification saved", {
        userId: task.userId,
        taskId: task.id,
      });
    } catch (error) {
      logger.error("Error creating TASK_CREATED notification", { error });
    }
  }

  /**
   * Create TASK_DELETED notification (stored in DB only)
   */
  async createTaskDeletedNotification(task: any) {
    try {
      await prisma.notification.create({
        data: {
          userId: task.userId,
          type: "TASK_DELETED",
          title: "Task Deleted",
          message: `"${task.title}" has been deleted`,
          taskId: task.id,
          scheduledTime: new Date(),
          isSent: true,
          sentAt: new Date(),
          isRead: false,
        },
      });

      logger.info("TASK_DELETED notification saved", {
        userId: task.userId,
        taskId: task.id,
      });
    } catch (error) {
      logger.error("Error creating TASK_DELETED notification", { error });
    }
  }

  /**
   * Get unread notifications for a user
   */
  async getUnreadNotifications(userId: number) {
    try {
      const notifications = await prisma.notification.findMany({
        where: {
          userId,
          isSent: true,
          isRead: false,
        },
        orderBy: { scheduledTime: "desc" },
        take: 50,
      });

      return notifications;
    } catch (error) {
      logger.error("Error fetching unread notifications", { error });
      return [];
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: number) {
    try {
      return await prisma.notification.update({
        where: { id: notificationId },
        data: { isRead: true },
      });
    } catch (error) {
      logger.error("Error marking notification as read", { error });
      return null;
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: number) {
    try {
      await prisma.notification.delete({
        where: { id: notificationId },
      });
      logger.info("Notification deleted", { notificationId });
    } catch (error) {
      logger.error("Error deleting notification", { error });
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();

// Export convenience functions for external use
export const createEventCreatedNotification = async (event: any) =>
  notificationService.createEventCreatedNotification(event);

export const createEventUpdatedNotification = async (event: any) =>
  notificationService.createEventUpdatedNotification(event);

export const createEventDeletedNotification = async (data: any) =>
  notificationService.createEventDeletedNotification(data);

export const createTaskCreatedNotification = async (task: any) =>
  notificationService.createTaskCreatedNotification(task);

export const createTaskDeletedNotification = async (task: any) =>
  notificationService.createTaskDeletedNotification(task);

export const getUnreadNotifications = async (userId: number) =>
  notificationService.getUnreadNotifications(userId);

export const markAsRead = async (notificationId: number) =>
  notificationService.markAsRead(notificationId);

export const deleteNotification = async (notificationId: number) =>
  notificationService.deleteNotification(notificationId);
