/*  
*  FILE          : logging.ts 
*  PROJECT       : PROG3221 - capstone
*  PROGRAMMER    : Ayushkumar Rakholiya, Jal Shah, Darsh Patel and Virajsinh Solanki 
*  FIRST VERSION : 2026-02-01 
*  DESCRIPTION   : 
*    Structured logging service with different log levels.
*/ 

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === "development";

  private format(level: LogLevel, message: string, context?: Record<string, any>): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
    };
  }

  debug(message: string, context?: Record<string, any>): void {
    if (this.isDevelopment) {
      const entry = this.format("debug", message, context);
      console.log("🔍 DEBUG:", JSON.stringify(entry));
    }
  }

  info(message: string, context?: Record<string, any>): void {
    const entry = this.format("info", message, context);
    console.log("ℹ️  INFO:", JSON.stringify(entry));
  }

  warn(message: string, context?: Record<string, any>): void {
    const entry = this.format("warn", message, context);
    console.warn("⚠️  WARN:", JSON.stringify(entry));
  }

  error(message: string, error?: Error | unknown, context?: Record<string, any>): void {
    const entry = this.format("error", message, {
      ...context,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    console.error("❌ ERROR:", JSON.stringify(entry));
  }
}

export const logger = new Logger();
