/*  
*  FILE          : redis.ts 
*  PROJECT       : PROG3221 - capstone
*  PROGRAMMER    : Ayushkumar Rakholiya, Jal Shah, Darsh Patel and Virajsinh Solanki 
*  FIRST VERSION : 2026-02-01 
*  DESCRIPTION   : 
*    Sets up and exports Redis client for queuing and caching throughout the app.
*/ 

import IORedis from "ioredis";

// Builds the Redis connection config from the REDIS_URL env variable if available,
// otherwise falls back to localhost
export const redisConfig = {
  maxRetriesPerRequest: null,
  ...(process.env.REDIS_URL
    ? (() => {
        const url = new URL(process.env.REDIS_URL!);
        return {
          host: url.hostname,
          port: Number(url.port) || 6379,
          ...(url.password ? { password: url.password } : {}),
        };
      })()
    : { host: "localhost", port: 6379 }),
};

// Redis client instance used throughout the app
export const redis = new IORedis(
  process.env.REDIS_URL ?? "redis://localhost:6379",
  { maxRetriesPerRequest: null }
);