"use strict";
/*
*  FILE          : calendarWorker.ts
*  PROJECT       : PROG3221 - capstone
*  PROGRAMMER    : Ayushkumar Rakholiya, Jal Shah, Darsh Patel and Virajsinh Solanki
*  FIRST VERSION : 2026-02-01
*  DESCRIPTION   :
*    Background worker for processing calendar synchronization jobs.
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.calendarWorker = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../redis");
exports.calendarWorker = new bullmq_1.Worker("calendar-sync", async (job) => {
    // Later: sync Google/Microsoft calendar here
    console.log("Processing job:", job.name, job.data);
    return { done: true };
}, { connection: redis_1.redisConfig });
exports.calendarWorker.on("completed", (job) => console.log("Job completed:", job.id));
exports.calendarWorker.on("failed", (job, err) => console.log("Job failed:", job?.id, err));
