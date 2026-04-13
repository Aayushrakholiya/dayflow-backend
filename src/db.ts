/*  
*  FILE          : db.ts 
*  PROJECT       : PROG3221 - capstone
*  PROGRAMMER    : Ayushkumar Rakholiya, Jal Shah, Darsh Patel and Virajsinh Solanki 
*  FIRST VERSION : 2026-02-01 
*  DESCRIPTION   : 
*    Sets up and exports the Prisma database client for application-wide use.
*/ 

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

// Create a single Prisma instance to be shared across the application
const prisma = new PrismaClient({ adapter });

export default prisma;
export { prisma };
export const db = prisma as any;
