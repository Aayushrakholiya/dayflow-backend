/*  
*  FILE          : calendarWorker.ts 
*  PROJECT       : PROG3221 - capstone
*  PROGRAMMER    : Ayushkumar Rakholiya, Jal Shah, Darsh Patel and Virajsinh Solanki 
*  FIRST VERSION : 2026-02-01 
*  DESCRIPTION   : 
*    Background worker for processing calendar synchronization jobs.
*/ 

import { Worker } from "bullmq";
import { redisConfig } from "../redis";

export const calendarWorker = new Worker(
  "calendar-sync",
  async (job) => {
    // Later: sync Google/Microsoft calendar here
    console.log("Processing job:", job.name, job.data);
    return { done: true };
  },
  { connection: redisConfig }
);

calendarWorker.on("completed", (job) => console.log("Job completed:", job.id));
calendarWorker.on("failed", (job, err) => console.log("Job failed:", job?.id, err));