/*  
*  FILE          : auth.ts 
*  PROJECT       : PROG3221 - capstone
*  PROGRAMMER    : Ayushkumar Rakholiya, Jal Shah, Darsh Patel and Virajsinh Solanki 
*  FIRST VERSION : 2026-02-01 
*  DESCRIPTION   : 
*    Authentication middleware verifying user ownership and attached userId to request.
*/ 

import { Request, Response, NextFunction } from "express";

/**
 * Authentication middleware - verify user ownership
 * Attaches userId to request if valid
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    let userId = Array.isArray(req.params.userId) 
      ? req.params.userId[0] 
      : req.params.userId;
    
    const bodyUserId = req.body?.userId;

    // Get userId from params or body
    const targetUserId = userId || bodyUserId;

    if (!targetUserId) {
      res.status(400).json({ error: "User ID is required" });
      return;
    }

    // Parse and validate userId
    const userIdStr = typeof targetUserId === 'string' ? targetUserId : String(targetUserId);
    const parsedUserId = parseInt(userIdStr, 10);
    if (isNaN(parsedUserId) || parsedUserId <= 0) {
      res.status(400).json({ error: "Invalid user ID format" });
      return;
    }

    // TODO: Replace with actual JWT/session verification
    // For now, we accept any valid userId
    // In production, verify the userId matches the authenticated user from JWT token

    // Attach userId to request for later use
    (req as any).userId = parsedUserId;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
}
