"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calendarWorker = void 0;
const bullmq_1 = require("bullmq");
exports.calendarWorker = new bullmq_1.Worker("calendar-sync", async (job) => {
    // Later: sync Google/Microsoft calendar here
    console.log("Processing job:", job.name, job.data);
    return { done: true };
}, {
    connection: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379"),
        maxRetriesPerRequest: null,
    },
});
exports.calendarWorker.on("completed", (job) => console.log("Job completed:", job.id));
exports.calendarWorker.on("failed", (job, err) => console.log("Job failed:", job?.id, err));
