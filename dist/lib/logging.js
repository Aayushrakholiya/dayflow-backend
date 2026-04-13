"use strict";
/*
*  FILE          : logging.ts
*  PROJECT       : PROG3221 - capstone
*  PROGRAMMER    : Ayushkumar Rakholiya, Jal Shah, Darsh Patel and Virajsinh Solanki
*  FIRST VERSION : 2026-02-01
*  DESCRIPTION   :
*    Structured logging service with different log levels.
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
class Logger {
    isDevelopment = process.env.NODE_ENV === "development";
    format(level, message, context) {
        return {
            timestamp: new Date().toISOString(),
            level,
            message,
            context,
        };
    }
    debug(message, context) {
        if (this.isDevelopment) {
            const entry = this.format("debug", message, context);
            console.log("🔍 DEBUG:", JSON.stringify(entry));
        }
    }
    info(message, context) {
        const entry = this.format("info", message, context);
        console.log("ℹ️  INFO:", JSON.stringify(entry));
    }
    warn(message, context) {
        const entry = this.format("warn", message, context);
        console.warn("⚠️  WARN:", JSON.stringify(entry));
    }
    error(message, error, context) {
        const entry = this.format("error", message, {
            ...context,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        console.error("❌ ERROR:", JSON.stringify(entry));
    }
}
exports.logger = new Logger();
