"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEventNotifications = createEventNotifications;
exports.createTaskNotifications = createTaskNotifications;
exports.createEventCreatedNotification = createEventCreatedNotification;
exports.createTaskCreatedNotification = createTaskCreatedNotification;
exports.createEventUpdatedNotification = createEventUpdatedNotification;
exports.createEventCompletedNotification = createEventCompletedNotification;
exports.createConflictNotification = createConflictNotification;
exports.createEventDeletedNotification = createEventDeletedNotification;
exports.createTaskDeletedNotification = createTaskDeletedNotification;
exports.createWeatherNotification = createWeatherNotification;
exports.deletePendingEventNotifications = deletePendingEventNotifications;
exports.deletePendingTaskNotifications = deletePendingTaskNotifications;
const db_1 = __importDefault(require("./db"));
const socket_1 = require("./socket");
const logging_1 = require("./lib/logging");
function combineDateAndHour(baseDate, hourFloat) {
    const date = new Date(baseDate);
    const hours = Math.floor(hourFloat);
    const minutes = Math.round((hourFloat - hours) * 60);
    date.setHours(hours, minutes, 0, 0);
    return date;
}
function formatHour(hourFloat) {
    const hours = Math.floor(hourFloat);
    const minutes = Math.round((hourFloat - hours) * 60);
    const tempDate = new Date();
    tempDate.setHours(hours, minutes, 0, 0);
    return tempDate.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
    });
}
async function createNotification(data) {
    if (isNaN(data.scheduledTime.getTime()))
        return null;
    return await db_1.default.notification.create({
        data: {
            userId: data.userId,
            type: data.type,
            title: data.title,
            message: data.message,
            scheduledTime: data.scheduledTime,
            eventId: data.eventId ?? null,
            taskId: data.taskId ?? null,
            isSent: data.isSent ?? false,
            sentAt: data.sentAt ?? null,
        },
    });
}
/* =========================================
   Scheduled event notifications
========================================= */
async function createEventNotifications(event) {
    const eventTitle = event.title?.trim() || "Untitled event";
    const eventStart = combineDateAndHour(new Date(event.date), event.startHour);
    const eventEnd = combineDateAndHour(new Date(event.date), event.endHour);
    const reminders = [
        {
            type: "EVENT_REMINDER",
            title: "Upcoming Event",
            message: `${eventTitle} starts in 1 hour`,
            scheduledTime: new Date(eventStart.getTime() - 60 * 60 * 1000),
        },
        {
            type: "EVENT_REMINDER",
            title: "Upcoming Event",
            message: `${eventTitle} starts in 30 minutes`,
            scheduledTime: new Date(eventStart.getTime() - 30 * 60 * 1000),
        },
        {
            type: "EVENT_REMINDER",
            title: "Upcoming Event",
            message: `${eventTitle} starts in 15 minutes`,
            scheduledTime: new Date(eventStart.getTime() - 15 * 60 * 1000),
        },
        {
            type: "EVENT_NOW",
            title: "Event Starting",
            message: `${eventTitle} is starting now`,
            scheduledTime: eventStart,
        },
        {
            type: "EVENT_ENDING_SOON",
            title: "Event Ending Soon",
            message: `${eventTitle} is ending in 15 minutes`,
            scheduledTime: new Date(eventEnd.getTime() - 15 * 60 * 1000),
        },
        {
            type: "EVENT_MISSED",
            title: "Missed Event",
            message: `You missed ${eventTitle}`,
            scheduledTime: new Date(eventEnd.getTime() + 5 * 60 * 1000),
        },
    ];
    const now = new Date();
    for (const r of reminders) {
        if (r.scheduledTime > now) {
            await createNotification({
                userId: event.userId,
                type: r.type,
                title: r.title,
                message: r.message,
                scheduledTime: r.scheduledTime,
                eventId: event.id,
            });
        }
    }
}
/* =========================================
   Scheduled task notifications
========================================= */
async function createTaskNotifications(task) {
    const taskTitle = task.title?.trim() || "Untitled task";
    const start = combineDateAndHour(new Date(task.dueDate), task.startHour);
    const end = combineDateAndHour(new Date(task.dueDate), task.endHour);
    const dueTodayTime = new Date(task.dueDate);
    dueTodayTime.setHours(9, 0, 0, 0);
    const reminders = [
        {
            type: "TASK_DUE_TODAY",
            title: "Task Due Today",
            message: `${taskTitle} is due today`,
            scheduledTime: dueTodayTime,
        },
        {
            type: "TASK_REMINDER",
            title: "Upcoming Task",
            message: `${taskTitle} starts in 1 hour`,
            scheduledTime: new Date(start.getTime() - 60 * 60 * 1000),
        },
        {
            type: "TASK_REMINDER",
            title: "Upcoming Task",
            message: `${taskTitle} starts in 15 minutes`,
            scheduledTime: new Date(start.getTime() - 15 * 60 * 1000),
        },
        {
            type: "TASK_DUE",
            title: "Task Due",
            message: `${taskTitle} is due now`,
            scheduledTime: end,
        },
        {
            type: "TASK_OVERDUE",
            title: "Task Overdue",
            message: `${taskTitle} is overdue`,
            scheduledTime: new Date(end.getTime() + 30 * 60 * 1000),
        },
    ];
    const now = new Date();
    for (const r of reminders) {
        if (r.scheduledTime > now) {
            await createNotification({
                userId: task.userId,
                type: r.type,
                title: r.title,
                message: r.message,
                scheduledTime: r.scheduledTime,
                taskId: task.id,
            });
        }
    }
}
/* =========================================
   Instant notifications
========================================= */
async function createEventCreatedNotification(event) {
    const eventTitle = event.title?.trim() || "Untitled event";
    const notification = await createNotification({
        userId: event.userId,
        type: "EVENT_CREATED",
        title: "Event Created",
        message: `${eventTitle} has been created for ${formatHour(event.startHour)}`,
        scheduledTime: new Date(),
        eventId: event.id,
        isSent: true,
        sentAt: new Date(),
    });
    // Deliver immediately via Socket.io (instant notification)
    if (notification) {
        try {
            await (0, socket_1.sendPushNotificationViaSocket)({
                userId: event.userId,
                type: "EVENT_CREATED",
                title: "Event Created",
                message: `${eventTitle} has been created for ${formatHour(event.startHour)}`,
                id: notification.id,
                eventId: event.id,
            });
            logging_1.logger.info("Instant EVENT_CREATED notification delivered", {
                notificationId: notification.id,
                eventId: event.id,
            });
        }
        catch (error) {
            logging_1.logger.error("Failed to deliver instant EVENT_CREATED notification", { error });
        }
    }
}
async function createTaskCreatedNotification(task) {
    const taskTitle = task.title?.trim() || "Untitled task";
    const notification = await createNotification({
        userId: task.userId,
        type: "TASK_CREATED",
        title: "Task Created",
        message: `${taskTitle} has been created for ${formatHour(task.startHour)}`,
        scheduledTime: new Date(),
        taskId: task.id,
        isSent: true,
        sentAt: new Date(),
    });
    // Deliver immediately via Socket.io (instant notification)
    if (notification) {
        try {
            await (0, socket_1.sendPushNotificationViaSocket)({
                userId: task.userId,
                type: "TASK_CREATED",
                title: "Task Created",
                message: `${taskTitle} has been created for ${formatHour(task.startHour)}`,
                id: notification.id,
                taskId: task.id,
            });
            logging_1.logger.info("Instant TASK_CREATED notification delivered", {
                notificationId: notification.id,
                taskId: task.id,
            });
        }
        catch (error) {
            logging_1.logger.error("Failed to deliver instant TASK_CREATED notification", { error });
        }
    }
}
async function createEventUpdatedNotification(event) {
    const eventTitle = event.title?.trim() || "Untitled event";
    const notification = await createNotification({
        userId: event.userId,
        type: "EVENT_UPDATED",
        title: "Event Updated",
        message: `${eventTitle} has been updated to ${formatHour(event.startHour)}`,
        scheduledTime: new Date(),
        eventId: event.id,
        isSent: true,
        sentAt: new Date(),
    });
    // Deliver immediately via Socket.io
    if (notification) {
        try {
            await (0, socket_1.sendPushNotificationViaSocket)({
                userId: event.userId,
                type: "EVENT_UPDATED",
                title: "Event Updated",
                message: `${eventTitle} has been updated to ${formatHour(event.startHour)}`,
                id: notification.id,
                eventId: event.id,
            });
        }
        catch (error) {
            logging_1.logger.error("Failed to deliver instant EVENT_UPDATED notification", { error });
        }
    }
}
async function createEventCompletedNotification(event) {
    const eventTitle = event.title?.trim() || "Untitled event";
    const notification = await createNotification({
        userId: event.userId,
        type: "EVENT_COMPLETED",
        title: "Event Completed",
        message: `${eventTitle} was marked as completed`,
        scheduledTime: new Date(),
        eventId: event.id,
        isSent: true,
        sentAt: new Date(),
    });
    // Deliver immediately via Socket.io
    if (notification) {
        try {
            await (0, socket_1.sendPushNotificationViaSocket)({
                userId: event.userId,
                type: "EVENT_COMPLETED",
                title: "Event Completed",
                message: `${eventTitle} was marked as completed`,
                id: notification.id,
                eventId: event.id,
            });
        }
        catch (error) {
            logging_1.logger.error("Failed to deliver instant EVENT_COMPLETED notification", { error });
        }
    }
}
async function createConflictNotification(data) {
    const itemTitle = data.title?.trim() || (data.kind === "event" ? "Untitled event" : "Untitled task");
    const notification = await createNotification({
        userId: data.userId,
        type: "CONFLICT_WARNING",
        title: "Schedule Conflict",
        message: `⚠️ ${itemTitle} conflicts with another ${data.kind}`,
        scheduledTime: new Date(),
        isSent: true,
        sentAt: new Date(),
    });
    // Deliver immediately via Socket.io
    if (notification) {
        try {
            await (0, socket_1.sendPushNotificationViaSocket)({
                userId: data.userId,
                type: "CONFLICT_WARNING",
                title: "Schedule Conflict",
                message: `⚠️ ${itemTitle} conflicts with another ${data.kind}`,
                id: notification.id,
            });
        }
        catch (error) {
            logging_1.logger.error("Failed to deliver instant CONFLICT_WARNING notification", { error });
        }
    }
}
async function createEventDeletedNotification(data) {
    const eventTitle = data.title?.trim() || "Untitled event";
    const notification = await createNotification({
        userId: data.userId,
        type: "EVENT_DELETED",
        title: "Event Deleted",
        message: `${eventTitle} scheduled for ${formatHour(data.startHour)} was deleted`,
        scheduledTime: new Date(),
        isSent: true,
        sentAt: new Date(),
    });
    // Deliver immediately via Socket.io
    if (notification) {
        try {
            await (0, socket_1.sendPushNotificationViaSocket)({
                userId: data.userId,
                type: "EVENT_DELETED",
                title: "Event Deleted",
                message: `${eventTitle} scheduled for ${formatHour(data.startHour)} was deleted`,
                id: notification.id,
            });
        }
        catch (error) {
            logging_1.logger.error("Failed to deliver instant EVENT_DELETED notification", { error });
        }
    }
}
async function createTaskDeletedNotification(data) {
    const taskTitle = data.title?.trim() || "Untitled task";
    const notification = await createNotification({
        userId: data.userId,
        type: "TASK_DELETED",
        title: "Task Deleted",
        message: `${taskTitle} scheduled for ${formatHour(data.startHour)} was deleted`,
        scheduledTime: new Date(),
        isSent: true,
        sentAt: new Date(),
    });
    // Deliver immediately via Socket.io
    if (notification) {
        try {
            await (0, socket_1.sendPushNotificationViaSocket)({
                userId: data.userId,
                type: "TASK_DELETED",
                title: "Task Deleted",
                message: `${taskTitle} scheduled for ${formatHour(data.startHour)} was deleted`,
                id: notification.id,
            });
        }
        catch (error) {
            logging_1.logger.error("Failed to deliver instant TASK_DELETED notification", { error });
        }
    }
}
async function createWeatherNotification(data) {
    await createNotification({
        userId: data.userId,
        type: "WEATHER_ALERT",
        title: data.title,
        message: data.message,
        scheduledTime: new Date(),
        eventId: data.eventId ?? null,
        isSent: true,
        sentAt: new Date(),
    });
}
/* =========================================
   Delete pending notifications
========================================= */
async function deletePendingEventNotifications(eventId) {
    await db_1.default.notification.deleteMany({
        where: {
            eventId,
            isSent: false,
        },
    });
}
async function deletePendingTaskNotifications(taskId) {
    await db_1.default.notification.deleteMany({
        where: {
            taskId,
            isSent: false,
        },
    });
}
