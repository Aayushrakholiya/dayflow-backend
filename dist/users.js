"use strict";
/*
*  FILE          : users.ts
*  PROJECT       : PROG3221 - capstone
*  PROGRAMMER    : Ayushkumar Rakholiya, Jal Shah, Darsh Patel and Virajsinh Solanki
*  FIRST VERSION : 2026-02-01
*  DESCRIPTION   :
*    Saves FCM device tokens to user accounts for push notifications.
*/
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = __importDefault(require("./db"));
const logging_1 = require("./lib/logging");
const auth_1 = require("./middleware/auth");
const router = express_1.default.Router();
// Save device token for FCM
router.post("/:userId/device-token", auth_1.authMiddleware, async (req, res) => {
    try {
        const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
        const { deviceToken } = req.body;
        if (!deviceToken || typeof deviceToken !== "string") {
            return res.status(400).json({ message: "Invalid device token" });
        }
        // Get user and check if token already exists
        const user = await db_1.default.user.findUnique({ where: { id: parseInt(userId) } });
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
        await db_1.default.user.update({
            where: { id: parseInt(userId) },
            data: { deviceTokens: updatedTokens },
        });
        // logger.info("Device token saved", { userId: parseInt(userId), tokenCount: updatedTokens.length });
        res.json({ success: true, message: "Device token saved" });
    }
    catch (error) {
        logging_1.logger.error("Error saving device token", { error });
        res.status(500).json({ message: "Failed to save device token" });
    }
});
exports.default = router;
