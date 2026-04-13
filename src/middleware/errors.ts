/*  
*  FILE          : errors.ts 
*  PROJECT       : PROG3221 - capstone
*  PROGRAMMER    : Ayushkumar Rakholiya, Jal Shah, Darsh Patel and Virajsinh Solanki 
*  FIRST VERSION : 2026-02-01 
*  DESCRIPTION   : 
*    Global error handler and async request wrapper middleware.
*/ 

import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

/**
 * Global error handler middleware
 */
export function errorHandler(
  error: Error | ZodError<any>,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Zod validation error
  if (error instanceof ZodError) {
    res.status(400).json({
      error: "Validation error",
      details: error.issues.map((issue: any) => ({
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
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
