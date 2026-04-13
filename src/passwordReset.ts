/*  
*  FILE          : passwordReset.ts 
*  PROJECT       : PROG3221 - capstone
*  PROGRAMMER    : Ayushkumar Rakholiya, Jal Shah, Darsh Patel and Virajsinh Solanki 
*  FIRST VERSION : 2026-02-01 
*  DESCRIPTION   : 
*    Handles multi-step password reset with OTP verification and rate limiting.
*/ 
import express from "express";
import type { Express, Request, Response } from "express";
import argon2 from "argon2";
import prisma from "./db";

// -------------------- OTP Store --------------------

type OtpRecord = {
  code: string;
  expiresAt: number;
  attempts: number; // Track verification attempts
};

// In-memory OTP store (email -> otp record)
const otpStore = new Map<string, OtpRecord>();

// Rate limiting store (email -> request timestamps)
const rateLimitStore = new Map<string, number[]>();

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_OTP_ATTEMPTS = 5; // Max verification attempts per OTP
const MAX_OTP_REQUESTS_PER_HOUR = 3; // Max OTP requests per email per hour
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Cleanup expired OTPs periodically
setInterval(() => {
  const now = Date.now();
  for (const [email, record] of otpStore.entries()) {
    if (now > record.expiresAt) {
      otpStore.delete(email);
      console.log(`Cleaned up expired OTP for ${email}`);
    }
  }
}, 60000); // Clean every minute

// Cleanup old rate limit entries
setInterval(() => {
  const now = Date.now();
  for (const [email, timestamps] of rateLimitStore.entries()) {
    const validTimestamps = timestamps.filter(
      (ts) => now - ts < RATE_LIMIT_WINDOW_MS
    );
    if (validTimestamps.length === 0) {
      rateLimitStore.delete(email);
    } else {
      rateLimitStore.set(email, validTimestamps);
    }
  }
}, 5 * 60 * 1000); // Clean every 5 minutes

// -------------------- Validators / Helpers --------------------

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const isValidPassword = (password: string) =>
  password.length >= 6 && !password.includes(" ");

const isValidOtp = (otp: string) => /^\d{6}$/.test(otp);

const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits

// Check rate limit for OTP requests
function checkRateLimit(email: string): boolean {
  const now = Date.now();
  const requests = rateLimitStore.get(email) || [];
  
  // Filter out requests older than the window
  const recentRequests = requests.filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS
  );

  if (recentRequests.length >= MAX_OTP_REQUESTS_PER_HOUR) {
    return false;
  }

  // Add current request
  recentRequests.push(now);
  rateLimitStore.set(email, recentRequests);
  return true;
}

async function sendOtpEmail(to: string, code: string) {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.EMAIL_FROM;
  const fromName = process.env.EMAIL_FROM_NAME ?? "DayFlow";

  if (!apiKey)    throw new Error("Missing BREVO_API_KEY in environment.");
  if (!fromEmail) throw new Error("Missing EMAIL_FROM in environment.");

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "accept":       "application/json",
      "api-key":      apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender:      { name: fromName, email: fromEmail },
      to:          [{ email: to }],
      subject:     "DayFlow Password Reset OTP",
      htmlContent: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">DayFlow Password Reset</h2>
          <p>Your password reset OTP is:</p>
          <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${code}
          </div>
          <p style="color: #666;">This code expires in 5 minutes.</p>
          <p style="color: #999; font-size: 12px; margin-top: 30px;">If you didn't request this code, please ignore this email.</p>
        </div>
      `,
      textContent: `Your DayFlow OTP is: ${code}\n\nThis code expires in 5 minutes.\n\nIf you didn't request this code, please ignore this email.`,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as any;
    throw Object.assign(
      new Error(err.message ?? "Brevo email send failed"),
      { code: "BREVO_ERROR", brevoError: err }
    );
  }
}

// -------------------- Route Registration --------------------

/**
 * Prisma + Neon password reset routes.
 * Endpoints:
 * POST /api/auth/forgot-password
 * POST /api/auth/verify-otp
 * POST /api/auth/reset-password
 */
export function registerPasswordResetRoutes(app: Express) {
  // 1) Request OTP
  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    try {
      const { email } = req.body as { email?: string };

      // Input validation
      if (!email) {
        return res.status(400).json({ 
          message: "Email is required",
          code: "EMAIL_REQUIRED" 
        });
      }

      if (!isValidEmail(email)) {
        return res.status(400).json({ 
          message: "Invalid email format",
          code: "INVALID_EMAIL" 
        });
      }

      // Rate limiting check
      if (!checkRateLimit(email)) {
        return res.status(429).json({
          message: `Too many OTP requests. Please try again later.`,
          code: "RATE_LIMIT_EXCEEDED",
        });
      }

      // Check if user exists
      let user;
      try {
        user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, email: true },
        });
      } catch (dbError: any) {
        console.error("Database error during user lookup:", dbError);
        return res.status(500).json({
          message: "Database error. Please try again later.",
          code: "DATABASE_ERROR",
        });
      }

      if (!user) {
        return res.status(404).json({ 
          message: "No account found with that email",
          code: "USER_NOT_FOUND" 
        });
      }

      // Generate and store OTP
      const code = generateOtp();
      const expiresAt = Date.now() + OTP_TTL_MS;
      otpStore.set(email, { code, expiresAt, attempts: 0 });

      // Send OTP email
      try {
        await sendOtpEmail(email, code);
      } catch (emailError: any) {

        // Clean up OTP if email fails
        otpStore.delete(email);

        // Handle specific email errors
        if (emailError.code === "EAUTH") {
          return res.status(500).json({
            message: "Email service authentication failed. Please contact support.",
            code: "EMAIL_AUTH_ERROR",
          });
        }

        if (emailError.code === "ECONNECTION" || emailError.code === "ETIMEDOUT") {
          return res.status(500).json({
            message: "Unable to connect to email service. Please try again later.",
            code: "EMAIL_CONNECTION_ERROR",
          });
        }

        return res.status(500).json({
          message: "Failed to send OTP email. Please try again later.",
          code: "EMAIL_SEND_ERROR",
        });
      }

      return res.status(200).json({ 
        message: "OTP sent to your email. Please check your inbox.",
        code: "OTP_SENT" 
      });

    } catch (err: any) {
      console.error("Unexpected error in forgot-password:", err?.message || err);
      return res.status(500).json({
        message: "An unexpected error occurred. Please try again.",
        code: "INTERNAL_ERROR",
      });
    }
  });

  // 2) Verify OTP
  app.post("/api/auth/verify-otp", (req: Request, res: Response) => {
    try {
      const { email, otp } = req.body as { email?: string; otp?: string };

      // Input validation
      if (!email || !otp) {
        return res.status(400).json({ 
          message: "Email and OTP are required",
          code: "MISSING_FIELDS" 
        });
      }

      if (!isValidEmail(email)) {
        return res.status(400).json({ 
          message: "Invalid email format",
          code: "INVALID_EMAIL" 
        });
      }

      if (!isValidOtp(otp)) {
        return res.status(400).json({ 
          message: "OTP must be 6 digits",
          code: "INVALID_OTP_FORMAT" 
        });
      }

      // Check if OTP exists
      const record = otpStore.get(email);
      if (!record) {
        return res.status(400).json({
          message: "No OTP request found. Please request a new OTP.",
          code: "OTP_NOT_FOUND",
        });
      }

      // Check if OTP expired
      if (Date.now() > record.expiresAt) {
        otpStore.delete(email);
        return res.status(400).json({ 
          message: "OTP expired. Please request a new OTP.",
          code: "OTP_EXPIRED" 
        });
      }

      // Check max attempts
      if (record.attempts >= MAX_OTP_ATTEMPTS) {
        otpStore.delete(email);
        return res.status(400).json({
          message: "Maximum verification attempts exceeded. Please request a new OTP.",
          code: "MAX_ATTEMPTS_EXCEEDED",
        });
      }

      // Verify OTP
      if (otp !== record.code) {
        record.attempts += 1;
        otpStore.set(email, record);
        
        const remainingAttempts = MAX_OTP_ATTEMPTS - record.attempts;
        return res.status(400).json({ 
          message: `Invalid OTP. ${remainingAttempts} attempt(s) remaining.`,
          code: "INVALID_OTP",
          remainingAttempts 
        });
      }

      // OTP verified successfully
      return res.status(200).json({ 
        message: "OTP verified successfully",
        code: "OTP_VERIFIED" 
      });

    } catch (err: any) {
      console.error("Unexpected error in verify-otp:", err?.message || err);
      return res.status(500).json({
        message: "An unexpected error occurred. Please try again.",
        code: "INTERNAL_ERROR",
      });
    }
  });

  // 3) Reset password (verifies OTP + updates Prisma user password)
  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    try {
      const { email, otp, newPassword } = req.body as {
        email?: string;
        otp?: string;
        newPassword?: string;
      };

      // Input validation
      if (!email || !otp || !newPassword) {
        return res.status(400).json({
          message: "Email, OTP, and new password are required",
          code: "MISSING_FIELDS",
        });
      }

      if (!isValidEmail(email)) {
        return res.status(400).json({ 
          message: "Invalid email format",
          code: "INVALID_EMAIL" 
        });
      }

      if (!isValidOtp(otp)) {
        return res.status(400).json({ 
          message: "OTP must be 6 digits",
          code: "INVALID_OTP_FORMAT" 
        });
      }

      if (!isValidPassword(newPassword)) {
        return res.status(400).json({
          message: "Password must be at least 6 characters and contain no spaces",
          code: "INVALID_PASSWORD",
        });
      }

      // Check if OTP exists
      const record = otpStore.get(email);
      if (!record) {
        return res.status(400).json({
          message: "No OTP request found. Please request a new OTP.",
          code: "OTP_NOT_FOUND",
        });
      }

      // Check if OTP expired
      if (Date.now() > record.expiresAt) {
        otpStore.delete(email);
        return res.status(400).json({ 
          message: "OTP expired. Please request a new OTP.",
          code: "OTP_EXPIRED" 
        });
      }

      // Check max attempts
      if (record.attempts >= MAX_OTP_ATTEMPTS) {
        otpStore.delete(email);
        return res.status(400).json({
          message: "Maximum verification attempts exceeded. Please request a new OTP.",
          code: "MAX_ATTEMPTS_EXCEEDED",
        });
      }

      // Verify OTP
      if (otp !== record.code) {
        record.attempts += 1;
        otpStore.set(email, record);
        
        const remainingAttempts = MAX_OTP_ATTEMPTS - record.attempts;
        return res.status(400).json({ 
          message: `Invalid OTP. ${remainingAttempts} attempt(s) remaining.`,
          code: "INVALID_OTP",
          remainingAttempts 
        });
      }

      // Check if user exists
      let existingUser;
      try {
        existingUser = await prisma.user.findUnique({
          where: { email },
          select: { id: true },
        });
      } catch (dbError: any) {
        console.error("Database error during user lookup:", dbError);
        return res.status(500).json({
          message: "Database error. Please try again later.",
          code: "DATABASE_ERROR",
        });
      }

      if (!existingUser) {
        otpStore.delete(email);
        return res.status(404).json({ 
          message: "No account found with that email",
          code: "USER_NOT_FOUND" 
        });
      }

      // Hash password
      let hashed: string;
      try {
        hashed = await argon2.hash(newPassword);
      } catch (hashError: any) {
        console.error("Password hashing error:", hashError);
        return res.status(500).json({
          message: "Password processing error. Please try again.",
          code: "HASH_ERROR",
        });
      }

      // Update password in database
      try {
        await prisma.user.update({
          where: { email },
          data: { password: hashed },
        });
      } catch (dbError: any) {
        console.error("Database error during password update:", dbError);
        return res.status(500).json({
          message: "Failed to update password. Please try again.",
          code: "DATABASE_UPDATE_ERROR",
        });
      }

      // Clean up OTP (one-time use)
      otpStore.delete(email);

      return res.status(200).json({ 
        message: "Password updated successfully. You can now log in with your new password.",
        code: "PASSWORD_RESET_SUCCESS" 
      });

    } catch (err: any) {
      console.error("Unexpected error in reset-password:", err?.message || err);
      return res.status(500).json({
        message: "An unexpected error occurred. Please try again.",
        code: "INTERNAL_ERROR",
      });
    }
  });
}