/**
 * Compatibility re-export — use server-log as the single structured logger.
 * Prefer: logServer / logServerInfo / logServerWarn / logServerError / logServerDebug
 */
export {
  logServer,
  logServerDebug,
  logServerInfo,
  logServerWarn,
  logServerError,
  formatServerLog,
  getEffectiveLogLevel,
  shouldLog,
  redactEmail,
  redactPhone,
  type LogLevel,
} from "./server-log";

import { logServer } from "./server-log";

/** Legacy object API used by a few call sites. */
export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) =>
    logServer("debug", "app", message, meta),
  info: (message: string, meta?: Record<string, unknown>) =>
    logServer("info", "app", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) =>
    logServer("warn", "app", message, meta),
  error: (message: string, meta?: Record<string, unknown>) =>
    logServer("error", "app", message, meta),
};
