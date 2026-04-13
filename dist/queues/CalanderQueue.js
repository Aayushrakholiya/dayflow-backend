"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calendarQueue = void 0;
const bullmq_1 = require("bullmq");
exports.calendarQueue = new bullmq_1.Queue("calendar-sync", {
    connection: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379"),
        maxRetriesPerRequest: null,
    },
});
