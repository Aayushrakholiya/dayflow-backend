"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processDueNotifications = processDueNotifications;
const db_1 = __importDefault(require("./db"));
const deliveryService_1 = require("./services/deliveryService");
const notification_1 = require("./config/notification");
const logging_1 = require("./lib/logging");
async function processDueNotifications() {
    try {
        const now = new Date();
        // Fetch full notification details including user info
        const due = await db_1.default.notification.findMany({
            where: {
                isSent: false,
                scheduledTime: {
                    lte: now,
                },
            },
            include: {
                user: {
                    select: { id: true, email: true },
                },
            },
        });
        if (due.length === 0)
            return;
        logging_1.logger.info("Processing due notifications", { count: due.length });
        let successCount = 0;
        let failureCount = 0;
        // Process each notification
        for (const notification of due) {
            try {
                // Determine delivery channels for this notification type
                const channels = notification_1.DEFAULT_CHANNELS[notification.type] || ["push"];
                logging_1.logger.debug("Delivering notification", {
                    id: notification.id,
                    type: notification.type,
                    channels,
                });
                // Deliver through appropriate channels
                const deliveryResult = await (0, deliveryService_1.deliverNotification)({
                    userId: notification.userId,
                    email: notification.user.email,
                    title: notification.title,
                    message: notification.message,
                    type: notification.type,
                }, channels);
                // Mark as sent only if delivery was successful
                if (deliveryResult.success) {
                    await db_1.default.notification.update({
                        where: { id: notification.id },
                        data: {
                            isSent: true,
                            sentAt: now,
                        },
                    });
                    successCount++;
                    logging_1.logger.info("Notification delivered and marked as sent", {
                        id: notification.id,
                        channels: deliveryResult.channels,
                    });
                }
                else {
                    failureCount++;
                    logging_1.logger.warn("Notification delivery failed", {
                        id: notification.id,
                        channels: deliveryResult.channels,
                    });
                }
            }
            catch (error) {
                failureCount++;
                logging_1.logger.error("Error processing individual notification", {
                    notificationId: notification.id,
                    error,
                });
            }
        }
        logging_1.logger.info("Notification batch processing completed", {
            total: due.length,
            success: successCount,
            failed: failureCount,
        });
    }
    catch (error) {
        logging_1.logger.error("Notification processing error:", { error });
    }
}
