import { Worker } from "bullmq";

export const calendarWorker = new Worker(
  "calendar-sync",
  async (job) => {
    // Later: sync Google/Microsoft calendar here
    console.log("Processing job:", job.name, job.data);
    return { done: true };
  },
  {
    connection: {
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      maxRetriesPerRequest: null,
    },
  }
);

calendarWorker.on("completed", (job) => console.log("Job completed:", job.id));
calendarWorker.on("failed", (job, err) => console.log("Job failed:", job?.id, err));
