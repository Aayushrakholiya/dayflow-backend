"use strict";
/*
*  FILE          : login.ts
*  PROJECT       : PROG3221 - capstone
*  PROGRAMMER    : Ayushkumar Rakholiya, Jal Shah, Darsh Patel and Virajsinh Solanki
*  FIRST VERSION : 2026-02-01
*  DESCRIPTION   :
*    Authenticates user credentials, verifies password, and returns JWT token.
*/
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = createLoginRouter;
const express_1 = __importDefault(require("express"));
const db_1 = __importDefault(require("./db"));
const argon2_1 = __importDefault(require("argon2"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function createLoginRouter() {
    const router = express_1.default.Router();
    // this will validate that if the user has entered proper email or not like the format of it
    const isValidEmail = (email) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };
    // this will validate if the user has entered password or not
    const isValidPassword = (password) => {
        // for login, we only check basic validity (not the full strength rules)
        // because existing users may have older passwords that still need to work.
        if (!password) {
            return false;
        }
        if (password.includes(" ")) {
            return false;
        }
        if (password.length < 6 || password.length > 128) {
            return false;
        }
        return true;
    };
    router.post("/login", async (req, res) => {
        try {
            // this will extract the input
            const { email, password } = req.body;
            // this will check if all the required fields are entered or not
            if (!email || !password) {
                return res.status(400).json({
                    message: "All fields are required",
                });
            }
            // this will validate the email that has been entered by the user
            if (!isValidEmail(email)) {
                return res.status(400).json({
                    message: "Invalid email format",
                });
            }
            // this will validate the password entered by the user
            if (!isValidPassword(password)) {
                return res.status(400).json({
                    message: "Invalid password format",
                });
            }
            // this will find the user by email
            const existingUser = await db_1.default.user.findUnique({
                where: { email },
            });
            if (!existingUser) {
                return res.status(401).json({
                    message: "Invalid email or password",
                });
            }
            // this will verify the password using argon2
            const isPasswordValid = await argon2_1.default.verify(existingUser.password, password);
            if (!isPasswordValid) {
                return res.status(401).json({
                    message: "Invalid email or password",
                });
            }
            // Sign a JWT containing userId, fullName and email
            const secret = process.env.JWT_SECRET;
            if (!secret) {
                return res.status(500).json({ message: "Server misconfiguration." });
            }
            const token = jsonwebtoken_1.default.sign({ userId: existingUser.id, fullName: existingUser.fullName, email: existingUser.email }, secret, { expiresIn: "7d", algorithm: "HS256" });
            return res.status(200).json({
                message: "Login successful",
                token,
                user: {
                    id: existingUser.id,
                    fullName: existingUser.fullName,
                    email: existingUser.email,
                },
            });
        }
        catch (error) {
            console.error("Login error:", error);
            return res.status(500).json({
                message: "Internal server error",
            });
        }
    });
    return router;
}
