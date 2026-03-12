"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPasswordResetRoutes = registerPasswordResetRoutes;
const node_process_1 = __importDefault(require("node:process"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const argon2_1 = __importDefault(require("argon2"));
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = __importDefault(require("pg"));
// -------------------- Prisma + Neon (same style as signup/login) --------------------
// Create PostgreSQL pool
const pool = new pg_1.default.Pool({
    connectionString: node_process_1.default.env.DATABASE_URL,
});
// Create adapter
const adapter = new adapter_pg_1.PrismaPg(pool);
// Initialize PrismaClient with adapter
const prisma = new client_1.PrismaClient({ adapter });
// In-memory OTP store (email -> otp record)
const otpStore = new Map();
// Rate limiting store (email -> request timestamps)
const rateLimitStore = new Map();
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
        const validTimestamps = timestamps.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
        if (validTimestamps.length === 0) {
            rateLimitStore.delete(email);
        }
        else {
            rateLimitStore.set(email, validTimestamps);
        }
    }
}, 5 * 60 * 1000); // Clean every 5 minutes
// -------------------- Validators / Helpers --------------------
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidPassword = (password) => password.length >= 6 && !password.includes(" ");
const isValidOtp = (otp) => /^\d{6}$/.test(otp);
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
// Check rate limit for OTP requests
function checkRateLimit(email) {
    const now = Date.now();
    const requests = rateLimitStore.get(email) || [];
    // Filter out requests older than the window
    const recentRequests = requests.filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);
    if (recentRequests.length >= MAX_OTP_REQUESTS_PER_HOUR) {
        return false;
    }
    // Add current request
    recentRequests.push(now);
    rateLimitStore.set(email, recentRequests);
    return true;
}
function getTransporter() {
    const user = node_process_1.default.env.EMAIL_USER;
    const pass = node_process_1.default.env.EMAIL_PASS;
    if (!user || !pass) {
        throw new Error("Missing EMAIL_USER or EMAIL_PASS in environment. Create backend/.env with EMAIL_USER and EMAIL_PASS.");
    }
    return nodemailer_1.default.createTransport({
        service: "gmail",
        auth: { user, pass },
    });
}
async function sendOtpEmail(to, code) {
    const transporter = getTransporter();
    await transporter.sendMail({
        from: node_process_1.default.env.EMAIL_USER,
        to,
        subject: "DayFlow Password Reset OTP",
        html: `
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
        text: `Your DayFlow OTP is: ${code}\n\nThis code expires in 5 minutes.\n\nIf you didn't request this code, please ignore this email.`,
    });
}
// -------------------- Route Registration --------------------
/**
 * Prisma + Neon password reset routes.
 * Endpoints:
 * POST /api/auth/forgot-password
 * POST /api/auth/verify-otp
 * POST /api/auth/reset-password
 */
function registerPasswordResetRoutes(app) {
    // 1) Request OTP
    app.post("/api/auth/forgot-password", async (req, res) => {
        try {
            const { email } = req.body;
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
            }
            catch (dbError) {
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
                console.log(`OTP sent to ${email}: ${code}`); // For development/testing
            }
            catch (emailError) {
                console.error("Email sending error:", emailError);
                // Clean up OTP if email fails
                otpStore.delete(email);
                // Handle specific email errors
                if (typeof emailError === "object" &&
                    emailError !== null &&
                    "code" in emailError) {
                    const err_code = emailError.code;
                    if (err_code === "EAUTH") {
                        return res.status(500).json({
                            message: "Email service authentication failed. Please contact support.",
                            code: "EMAIL_AUTH_ERROR",
                        });
                    }
                    if (err_code === "ECONNECTION" || err_code === "ETIMEDOUT") {
                        return res.status(500).json({
                            message: "Unable to connect to email service. Please try again later.",
                            code: "EMAIL_CONNECTION_ERROR",
                        });
                    }
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
        }
        catch (_err) {
            console.error("Unexpected error in forgot-password:", _err instanceof Error ? _err.message : _err);
            return res.status(500).json({
                message: "An unexpected error occurred. Please try again.",
                code: "INTERNAL_ERROR",
            });
        }
    });
    // 2) Verify OTP
    app.post("/api/auth/verify-otp", (req, res) => {
        try {
            const { email, otp } = req.body;
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
        }
        catch (_err) {
            console.error("Unexpected error in verify-otp:", _err instanceof Error ? _err.message : _err);
            return res.status(500).json({
                message: "An unexpected error occurred. Please try again.",
                code: "INTERNAL_ERROR",
            });
        }
    });
    // 3) Reset password (verifies OTP + updates Prisma user password)
    app.post("/api/auth/reset-password", async (req, res) => {
        try {
            const { email, otp, newPassword } = req.body;
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
            }
            catch (dbError) {
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
            let hashed;
            try {
                hashed = await argon2_1.default.hash(newPassword);
            }
            catch (hashError) {
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
            }
            catch (dbError) {
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
        }
        catch (_err) {
            console.error("Unexpected error in reset-password:", _err instanceof Error ? _err.message : _err);
            return res.status(500).json({
                message: "An unexpected error occurred. Please try again.",
                code: "INTERNAL_ERROR",
            });
        }
    });
}
