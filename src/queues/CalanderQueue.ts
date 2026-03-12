import { Queue } from "bullmq";

export const calendarQueue = new Queue("calendar-sync", {
  connection: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    maxRetriesPerRequest: null,
  },
});
