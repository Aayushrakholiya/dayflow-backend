"use strict";
/*
*  FILE          : notificationService.ts
*  PROJECT       : PROG3221 - capstone
*  PROGRAMMER    : Ayushkumar Rakholiya, Jal Shah, Darsh Patel and Virajsinh Solanki
*  FIRST VERSION : 2026-02-01
*  DESCRIPTION   :
*    Notification service layer for storing and retrieving notifications from database.
*/
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteNotification = exports.markAsRead = exports.getUnreadNotifications = exports.createTaskDeletedNotification = exports.createTaskCreatedNotification = exports.createEventDeletedNotification = exports.createEventUpdatedNotification = exports.createEventCreatedNotification = exports.notificationService = exports.NotificationService = void 0;
const db_1 = __importDefault(require("../db"));
const logging_1 = require("../lib/logging");
/**
 * Notification Service Layer
 * Stores event/task notifications for frontend to display via react-toastify
 */
class NotificationService {
    /**
     * Create EVENT_CREATED notification (stored in DB only)
     */
    async createEventCreatedNotification(event) {
        try {
            await db_1.default.notification.create({
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
            logging_1.logger.info("EVENT_CREATED notification saved", {
                userId: event.userId,
                eventId: event.id,
            });
        }
        catch (error) {
            logging_1.logger.error("Error creating EVENT_CREATED notification", { error });
        }
    }
    /**
     * Create EVENT_UPDATED notification (stored in DB only)
     */
    async createEventUpdatedNotification(event) {
        try {
            await db_1.default.notification.create({
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
            logging_1.logger.info("EVENT_UPDATED notification saved", {
                userId: event.userId,
                eventId: event.id,
            });
        }
        catch (error) {
            logging_1.logger.error("Error creating EVENT_UPDATED notification", { error });
        }
    }
    /**
     * Create EVENT_DELETED notification (stored in DB only)
     */
    async createEventDeletedNotification(data) {
        try {
            await db_1.default.notification.create({
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
            logging_1.logger.info("EVENT_DELETED notification saved", {
                userId: data.userId,
                eventId: data.id,
            });
        }
        catch (error) {
            logging_1.logger.error("Error creating EVENT_DELETED notification", { error });
        }
    }
    /**
     * Create TASK_CREATED notification (stored in DB only)
     */
    async createTaskCreatedNotification(task) {
        try {
            await db_1.default.notification.create({
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
            logging_1.logger.info("TASK_CREATED notification saved", {
                userId: task.userId,
                taskId: task.id,
            });
        }
        catch (error) {
            logging_1.logger.error("Error creating TASK_CREATED notification", { error });
        }
    }
    /**
     * Create TASK_DELETED notification (stored in DB only)
     */
    async createTaskDeletedNotification(task) {
        try {
            await db_1.default.notification.create({
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
            logging_1.logger.info("TASK_DELETED notification saved", {
                userId: task.userId,
                taskId: task.id,
            });
        }
        catch (error) {
            logging_1.logger.error("Error creating TASK_DELETED notification", { error });
        }
    }
    /**
     * Get unread notifications for a user
     */
    async getUnreadNotifications(userId) {
        try {
            const notifications = await db_1.default.notification.findMany({
                where: {
                    userId,
                    isSent: true,
                    isRead: false,
                },
                orderBy: { scheduledTime: "desc" },
                take: 50,
            });
            return notifications;
        }
        catch (error) {
            logging_1.logger.error("Error fetching unread notifications", { error });
            return [];
        }
    }
    /**
     * Mark notification as read
     */
    async markAsRead(notificationId) {
        try {
            return await db_1.default.notification.update({
                where: { id: notificationId },
                data: { isRead: true },
            });
        }
        catch (error) {
            logging_1.logger.error("Error marking notification as read", { error });
            return null;
        }
    }
    /**
     * Delete notification
     */
    async deleteNotification(notificationId) {
        try {
            await db_1.default.notification.delete({
                where: { id: notificationId },
            });
            logging_1.logger.info("Notification deleted", { notificationId });
        }
        catch (error) {
            logging_1.logger.error("Error deleting notification", { error });
        }
    }
}
exports.NotificationService = NotificationService;
// Export singleton instance
exports.notificationService = new NotificationService();
// Export convenience functions for external use
const createEventCreatedNotification = async (event) => exports.notificationService.createEventCreatedNotification(event);
exports.createEventCreatedNotification = createEventCreatedNotification;
const createEventUpdatedNotification = async (event) => exports.notificationService.createEventUpdatedNotification(event);
exports.createEventUpdatedNotification = createEventUpdatedNotification;
const createEventDeletedNotification = async (data) => exports.notificationService.createEventDeletedNotification(data);
exports.createEventDeletedNotification = createEventDeletedNotification;
const createTaskCreatedNotification = async (task) => exports.notificationService.createTaskCreatedNotification(task);
exports.createTaskCreatedNotification = createTaskCreatedNotification;
const createTaskDeletedNotification = async (task) => exports.notificationService.createTaskDeletedNotification(task);
exports.createTaskDeletedNotification = createTaskDeletedNotification;
const getUnreadNotifications = async (userId) => exports.notificationService.getUnreadNotifications(userId);
exports.getUnreadNotifications = getUnreadNotifications;
const markAsRead = async (notificationId) => exports.notificationService.markAsRead(notificationId);
exports.markAsRead = markAsRead;
const deleteNotification = async (notificationId) => exports.notificationService.deleteNotification(notificationId);
exports.deleteNotification = deleteNotification;
