/*  
*  FILE          : users.ts 
*  PROJECT       : PROG3221 - capstone
*  PROGRAMMER    : Ayushkumar Rakholiya, Jal Shah, Darsh Patel and Virajsinh Solanki 
*  FIRST VERSION : 2026-02-01 
*  DESCRIPTION   : 
*    Saves FCM device tokens to user accounts for push notifications.
*/ 

import express, { Request, Response } from "express";
import prisma from "./db";
import { logger } from "./lib/logging";
import { authMiddleware } from "./middleware/auth";

const router = express.Router();

// Save device token for FCM
router.post(
  "/:userId/device-token",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
      const { deviceToken } = req.body;

      if (!deviceToken || typeof deviceToken !== "string") {
        return res.status(400).json({ message: "Invalid device token" });
      }

      // Get user and check if token already exists
      const user = await prisma.user.findUnique({ where: { id: parseInt(userId) } });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const existingTokens = user.deviceTokens || [];
      
      // Only add token if it doesn't already exist
      if (existingTokens.includes(deviceToken)) {
        // logger.info("Device token already exists", { userId: parseInt(userId), tokenCount: existingTokens.length });
        return res.json({ success: true, message: "Device token already saved" });
      }

      const updatedTokens = [...existingTokens, deviceToken];

      await prisma.user.update({
        where: { id: parseInt(userId) },
        data: { deviceTokens: updatedTokens },
      });

      // logger.info("Device token saved", { userId: parseInt(userId), tokenCount: updatedTokens.length });

      res.json({ success: true, message: "Device token saved" });
    } catch (error) {
      logger.error("Error saving device token", { error });
      res.status(500).json({ message: "Failed to save device token" });
    }
  }
);

export default router;
