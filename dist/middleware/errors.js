"use strict";
/*
*  FILE          : errors.ts
*  PROJECT       : PROG3221 - capstone
*  PROGRAMMER    : Ayushkumar Rakholiya, Jal Shah, Darsh Patel and Virajsinh Solanki
*  FIRST VERSION : 2026-02-01
*  DESCRIPTION   :
*    Global error handler and async request wrapper middleware.
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
exports.asyncHandler = asyncHandler;
const zod_1 = require("zod");
/**
 * Global error handler middleware
 */
function errorHandler(error, req, res, next) {
    // Zod validation error
    if (error instanceof zod_1.ZodError) {
        res.status(400).json({
            error: "Validation error",
            details: error.issues.map((issue) => ({
                path: issue.path.join("."),
                message: issue.message,
            })),
        });
        return;
    }
    // Database errors
    if (error.message.includes("prisma")) {
        console.error("Database error:", error);
        res.status(500).json({
            error: "Database operation failed",
        });
        return;
    }
    // Unknown errors
    console.error("Unhandled error:", error);
    res.status(500).json({
        error: "Internal server error",
        message: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
}
/**
 * Async route handler wrapper to catch promise rejections
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
