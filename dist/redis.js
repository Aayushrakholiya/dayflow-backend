"use strict";
/*
*  FILE          : redis.ts
*  PROJECT       : PROG3221 - capstone
*  PROGRAMMER    : Ayushkumar Rakholiya, Jal Shah, Darsh Patel and Virajsinh Solanki
*  FIRST VERSION : 2026-02-01
*  DESCRIPTION   :
*    Sets up and exports Redis client for queuing and caching throughout the app.
*/
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = exports.redisConfig = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
// Builds the Redis connection config from the REDIS_URL env variable if available,
// otherwise falls back to localhost
exports.redisConfig = {
    maxRetriesPerRequest: null,
    ...(process.env.REDIS_URL
        ? (() => {
            const url = new URL(process.env.REDIS_URL);
            return {
                host: url.hostname,
                port: Number(url.port) || 6379,
                ...(url.password ? { password: url.password } : {}),
            };
        })()
        : { host: "localhost", port: 6379 }),
};
// Redis client instance used throughout the app
exports.redis = new ioredis_1.default(process.env.REDIS_URL ?? "redis://localhost:6379", { maxRetriesPerRequest: null });
