/*  
*  FILE          : fcmService.ts 
*  PROJECT       : PROG3221 - capstone
*  PROGRAMMER    : Ayushkumar Rakholiya, Jal Shah, Darsh Patel and Virajsinh Solanki 
*  FIRST VERSION : 2026-02-01 
*  DESCRIPTION   : 
*    Firebase Admin SDK service for sending push notifications to devices.
*/ 

import admin from "firebase-admin";
import { logger } from "../lib/logging";

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
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
    initialized = true;
    logger.info("Firebase Admin SDK initialized");
  } else {
    logger.warn("FIREBASE_SERVICE_ACCOUNT_JSON not set - FCM disabled");
  }
} catch (error) {
  logger.error("Failed to initialize Firebase Admin SDK", { error });
}

interface FCMMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
  icon?: string;
}

/**
 * Send FCM notification to a device
 */
export async function sendFCMNotification(
  deviceToken: string,
  message: FCMMessage
): Promise<boolean> {
  if (!initialized) {
    logger.warn("Firebase Admin SDK not initialized - skipping FCM");
    return false;
  }

  try {
    const response = await admin.messaging().send({
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
  } catch (error) {
    logger.error("Error sending FCM notification", { deviceToken: deviceToken.substring(0, 20) + "...", error });
    return false;
  }
}

/**
 * Send FCM to multiple devices
 */
export async function sendFCMToMultipleDevices(
  deviceTokens: string[],
  message: FCMMessage
): Promise<number> {
  if (!initialized) {
    logger.warn("Firebase Admin SDK not initialized - skipping FCM");
    return 0;
  }

  let successCount = 0;

  for (const token of deviceTokens) {
    const success = await sendFCMNotification(token, message);
    if (success) successCount++;
  }

  return successCount;
}

export default admin;
