"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = createUserProfileRouter;
const node_process_1 = __importDefault(require("node:process"));
const express_1 = __importDefault(require("express"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function createUserProfileRouter() {
    const router = express_1.default.Router();
    // Returns the fullName and email of the logged-in user by reading the JWT.
    router.get("/me", (req, res) => {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith("Bearer ")) {
                return res.status(401).json({ message: "No token provided." });
            }
            const token = authHeader.slice(7);
            const secret = node_process_1.default.env.JWT_SECRET;
            if (!secret) {
                return res.status(500).json({ message: "Server misconfiguration." });
            }
            let payload;
            try {
                payload = jsonwebtoken_1.default.verify(token, secret);
            }
            catch (_err) {
                return res.status(401).json({ message: "Invalid or expired token." });
            }
            return res.status(200).json({
                fullName: payload.fullName,
                email: payload.email,
            });
        }
        catch (_err) {
            return res.status(500).json({ message: "Internal server error." });
        }
    });
    return router;
}
