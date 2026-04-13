"use strict";
/*
*  FILE          : fcmService.ts
*  PROJECT       : PROG3221 - capstone
*  PROGRAMMER    : Ayushkumar Rakholiya, Jal Shah, Darsh Patel and Virajsinh Solanki
*  FIRST VERSION : 2026-02-01
*  DESCRIPTION   :
*    Firebase Admin SDK service for sending push notifications to devices.
*/
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendFCMNotification = sendFCMNotification;
exports.sendFCMToMultipleDevices = sendFCMToMultipleDevices;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const logging_1 = require("../lib/logging");
/**
 * Firebase Admin SDK for sending push notifications
 * IMPORTANT: Set FIREBASE_SERVICE_ACCOUNT_JSON in .env before using
 */
// Initialize Firebase Admin (if service account is provided)
let initialized = false;
try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (serviceAccountJson) {
        const serviceAccount = JSON.parse(serviceAccountJson);
        firebase_admin_1.default.initializeApp({
            credential: firebase_admin_1.default.credential.cert(serviceAccount),
            projectId: serviceAccount.project_id,
        });
        initialized = true;
        logging_1.logger.info("Firebase Admin SDK initialized");
    }
    else {
        logging_1.logger.warn("FIREBASE_SERVICE_ACCOUNT_JSON not set - FCM disabled");
    }
}
catch (error) {
    logging_1.logger.error("Failed to initialize Firebase Admin SDK", { error });
}
/**
 * Send FCM notification to a device
 */
async function sendFCMNotification(deviceToken, message) {
    if (!initialized) {
        logging_1.logger.warn("Firebase Admin SDK not initialized - skipping FCM");
        return false;
    }
    try {
        const response = await firebase_admin_1.default.messaging().send({
            token: deviceToken,
            notification: {
                title: message.title,
                body: message.body,
            },
            webpush: {
                notification: {
                    title: message.title,
                    body: message.body,
                    icon: message.icon || "/favicon.ico",
                    badge: "/favicon.ico",
                    tag: "dayflow-notification",
                    requireInteraction: true,
                },
                data: message.data || {},
            },
        });
        // logger.info("FCM notification sent", { deviceToken: deviceToken.substring(0, 20) + "...", response });
        return true;
    }
    catch (error) {
        logging_1.logger.error("Error sending FCM notification", { deviceToken: deviceToken.substring(0, 20) + "...", error });
        return false;
    }
}
/**
 * Send FCM to multiple devices
 */
async function sendFCMToMultipleDevices(deviceTokens, message) {
    if (!initialized) {
        logging_1.logger.warn("Firebase Admin SDK not initialized - skipping FCM");
        return 0;
    }
    let successCount = 0;
    for (const token of deviceTokens) {
        const success = await sendFCMNotification(token, message);
        if (success)
            successCount++;
    }
    return successCount;
}
exports.default = firebase_admin_1.default;
