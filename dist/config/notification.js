"use strict";
/**
 * Notification Configuration
 * Centralized configuration for all notification settings
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EMAIL_CONFIG = exports.DEFAULT_CHANNELS = exports.NOTIFICATION_TYPES = exports.PAGINATION = void 0;
// Pagination limits
exports.PAGINATION = {
    UNREAD_LIMIT: 50,
    ALL_NOTIFICATIONS_LIMIT: 100,
    DEFAULT_LIMIT: 20,
};
// Notification types
exports.NOTIFICATION_TYPES = {
    EVENT_CREATED: "EVENT_CREATED",
    EVENT_UPDATED: "EVENT_UPDATED",
    EVENT_DELETED: "EVENT_DELETED",
    EVENT_STARTED: "EVENT_STARTED",
    TASK_CREATED: "TASK_CREATED",
    TASK_DELETED: "TASK_DELETED",
    CONFLICT_WARNING: "CONFLICT_WARNING",
};
// Default delivery channels for different notification types
exports.DEFAULT_CHANNELS = {
    [exports.NOTIFICATION_TYPES.CONFLICT_WARNING]: ["push", "email"],
};
// Email configuration
exports.EMAIL_CONFIG = {
    from: process.env.SMTP_FROM || "noreply@dayflow.com",
    replyTo: process.env.SMTP_REPLY_TO || "support@dayflow.com",
};
