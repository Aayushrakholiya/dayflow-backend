"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmailNotification = sendEmailNotification;
exports.sendPushNotification = sendPushNotification;
exports.sendSMSNotification = sendSMSNotification;
exports.deliverNotification = deliverNotification;
const nodemailer_1 = __importDefault(require("nodemailer"));
const socket_1 = require("../socket");
// Configure email transporter
const transporter = nodemailer_1.default.createTransport({
    host: process.env.SMTP_HOST || "localhost",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
        }
        : undefined,
});
/**
 * Send email notification
 */
async function sendEmailNotification(payload) {
    try {
        if (!payload.email) {
            console.warn(`No email found for user ${payload.userId}`);
            return false;
        }
        await transporter.sendMail({
            from: process.env.SMTP_FROM || "noreply@dayflow.com",
            to: payload.email,
            subject: payload.title,
            html: `
        <h2>${payload.title}</h2>
        <p>${payload.message}</p>
        <small>Type: ${payload.type}</small>
      `,
            text: `${payload.title}\n\n${payload.message}`,
        });
        console.log(`✅ Email sent to ${payload.email} for user ${payload.userId}`);
        return true;
    }
    catch (error) {
        console.error(`❌ Failed to send email to ${payload.email}:`, error);
        return false;
    }
}
/**
 * Send push notification (via WebSocket/Socket.io)
 */
async function sendPushNotification(payload) {
    try {
        const result = await (0, socket_1.sendPushNotificationViaSocket)({
            userId: payload.userId,
            type: payload.type,
            title: payload.title,
            message: payload.message,
            id: payload.id,
            eventId: payload.eventId,
            taskId: payload.taskId,
        });
        if (result) {
            console.log(`✅ Push notification sent to user ${payload.userId}: ${payload.title}`);
        }
        else {
            console.warn(`⚠️  Push notification queued for user ${payload.userId} (user may be offline)`);
        }
        return result;
    }
    catch (error) {
        console.error(`❌ Failed to send push notification:`, error);
        return false;
    }
}
/**
 * Send SMS notification
 */
async function sendSMSNotification(payload) {
    try {
        // TODO: Implement SMS notification via Twilio or other service
        // For now, this is a placeholder for future SMS implementation
        console.log(`📱 SMS notification for user ${payload.userId}: ${payload.message}`);
        return true;
    }
    catch (error) {
        console.error(`❌ Failed to send SMS notification:`, error);
        return false;
    }
}
/**
 * Main delivery orchestrator - routes notification to appropriate channels
 */
async function deliverNotification(payload, channels = ["push"]) {
    const results = {};
    for (const channel of channels) {
        try {
            switch (channel) {
                case "email":
                    results.email = await sendEmailNotification(payload);
                    break;
                case "push":
                    results.push = await sendPushNotification(payload);
                    break;
                case "sms":
                    results.sms = await sendSMSNotification(payload);
                    break;
                default:
                    results[channel] = false;
            }
        }
        catch (error) {
            console.error(`Error delivering via ${channel}:`, error);
            results[channel] = false;
        }
    }
    const success = Object.values(results).some((result) => result === true);
    return { success, channels: results };
}
