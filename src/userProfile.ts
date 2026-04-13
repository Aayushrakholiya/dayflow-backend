/*  
*  FILE          : userProfile.ts 
*  PROJECT       : PROG3221 - capstone
*  PROGRAMMER    : Ayushkumar Rakholiya, Jal Shah, Darsh Patel and Virajsinh Solanki 
*  FIRST VERSION : 2026-02-01 
*  DESCRIPTION   : 
*    Returns logged-in user's name and email by reading their JWT token.
*/ 

import express from "express";
import jwt from "jsonwebtoken";

export default function createUserProfileRouter() {
  const router = express.Router();

  // Returns the fullName and email of the logged-in user by reading the JWT.
  router.get("/me", (req, res) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "No token provided." });
      }

      const token = authHeader.slice(7);
      const secret = process.env.JWT_SECRET;

      if (!secret) {
        return res.status(500).json({ message: "Server misconfiguration." });
      }

      let payload: { userId: number; fullName: string; email: string };

      try {
        payload = jwt.verify(token, secret) as {
          userId: number;
          fullName: string;
          email: string;
        };
      } catch (err) {
        return res.status(401).json({ message: "Invalid or expired token." });
      }

      return res.status(200).json({
        fullName: payload.fullName,
        email: payload.email,
      });
    } catch (err) {
      return res.status(500).json({ message: "Internal server error." });
    }
  });

  return router;
}