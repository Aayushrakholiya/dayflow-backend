"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeSocket = initializeSocket;
exports.getSocket = getSocket;
exports.sendPushNotificationViaSocket = sendPushNotificationViaSocket;
const socket_io_1 = require("socket.io");
const logging_1 = require("./lib/logging");
// Store user socket connections: userId -> socketId
const userSockets = new Map();
let io;
/**
 * Initialize Socket.io server
 */
function initializeSocket(httpServer) {
    io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: process.env.FRONTEND_URL || "http://localhost:5173",
            credentials: true,
        },
        transports: ["websocket", "polling"],
    });
    // Connection handler
    io.on("connection", (socket) => {
        logging_1.logger.info("Socket connected", { socketId: socket.id });
        // User joins notification room
        socket.on("register-user", (userId) => {
            socket.join(`user-${userId}`);
            if (!userSockets.has(userId)) {
                userSockets.set(userId, new Set());
            }
            userSockets.get(userId).add(socket.id);
            logging_1.logger.info("User registered for notifications", {
                userId,
                socketId: socket.id,
                totalUserSockets: userSockets.get(userId).size,
            });
            // Notify client of successful registration
            socket.emit("user-registered", { userId, socketId: socket.id });
        });
        // Handle disconnection
        socket.on("disconnect", () => {
            // Find and remove the socket from all users
            userSockets.forEach((sockets, userId) => {
                if (sockets.has(socket.id)) {
                    sockets.delete(socket.id);
                    logging_1.logger.info("User socket disconnected", { userId, socketId: socket.id });
                    if (sockets.size === 0) {
                        userSockets.delete(userId);
                    }
                }
            });
        });
        // Handle errors
        socket.on("error", (error) => {
            logging_1.logger.error("Socket error", { socketId: socket.id, error });
        });
    });
    logging_1.logger.info("Socket.io server initialized");
    return io;
}
/**
 * Get Socket.io instance
 */
function getSocket() {
    if (!io) {
        throw new Error("Socket.io not initialized. Call initializeSocket first.");
    }
    return io;
}
/**
 * Send push notification to user via Socket.io
 */
async function sendPushNotificationViaSocket(payload) {
    try {
        const io = getSocket();
        logging_1.logger.debug("Sending push notification via Socket.io", {
            userId: payload.userId,
            type: payload.type,
        });
        // Send to the user's room
        io.to(`user-${payload.userId}`).emit("notification", {
            id: payload.id,
            type: payload.type,
            title: payload.title,
            message: payload.message,
            eventId: payload.eventId ?? null,
            taskId: payload.taskId ?? null,
            timestamp: new Date().toISOString(),
        });
        logging_1.logger.info("Push notification sent via Socket.io", {
            userId: payload.userId,
            notificationId: payload.id,
        });
        return true;
    }
    catch (error) {
        logging_1.logger.error("Failed to send push notification via Socket.io", {
            userId: payload.userId,
            error,
        });
        return false;
    }
}
