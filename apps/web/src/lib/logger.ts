type LogLevel = "info" | "warn" | "error" | "debug";

interface LogPayload {
  level: LogLevel;
  message: string;
  requestId?: string;
  userId?: string;
  route?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
}

export function log(payload: LogPayload) {
  const entry = {
    timestamp: new Date().toISOString(),
    ...payload,
  };

  if (process.env.NODE_ENV === "production") {
    console.log(JSON.stringify(entry));
  } else {
    console[payload.level === "debug" ? "log" : payload.level](
      `[${entry.level.toUpperCase()}] ${entry.message}`,
      payload.metadata || ""
    );
  }
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => log({ level: "info", message, metadata: meta }),
  warn: (message: string, meta?: Record<string, unknown>) => log({ level: "warn", message, metadata: meta }),
  error: (message: string, meta?: Record<string, unknown>) => log({ level: "error", message, metadata: meta }),
  debug: (message: string, meta?: Record<string, unknown>) => log({ level: "debug", message, metadata: meta }),
};
