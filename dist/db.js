"use strict";
/*
*  FILE          : db.ts
*  PROJECT       : PROG3221 - capstone
*  PROGRAMMER    : Ayushkumar Rakholiya, Jal Shah, Darsh Patel and Virajsinh Solanki
*  FIRST VERSION : 2026-02-01
*  DESCRIPTION   :
*    Sets up and exports the Prisma database client for application-wide use.
*/
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.prisma = void 0;
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = __importDefault(require("pg"));
const pool = new pg_1.default.Pool({
    connectionString: process.env.DATABASE_URL,
});
const adapter = new adapter_pg_1.PrismaPg(pool);
// Create a single Prisma instance to be shared across the application
const prisma = new client_1.PrismaClient({ adapter });
exports.prisma = prisma;
exports.default = prisma;
exports.db = prisma;
