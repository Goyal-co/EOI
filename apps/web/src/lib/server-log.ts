import { AsyncLocalStorage } from "node:async_hooks";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export type RequestLogContext = {
  scope: string;
  method: string;
  path: string;
};

const requestLog = new AsyncLocalStorage<RequestLogContext>();

function parseLogLevel(raw?: string | null): LogLevel | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (v === "debug" || v === "info" || v === "warn" || v === "error") return v;
  return null;
}

/** Default: debug in non-production when unset; info in production. */
export function getEffectiveLogLevel(): LogLevel {
  const fromEnv = parseLogLevel(process.env.LOG_LEVEL);
  if (fromEnv) return fromEnv;
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

export function shouldLog(level: LogLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[getEffectiveLogLevel()];
}

export function runWithRequestLog<T>(ctx: RequestLogContext, fn: () => T): T {
  return requestLog.run(ctx, fn);
}

export function getRequestLogContext(): RequestLogContext | undefined {
  return requestLog.getStore();
}

export function requestPath(req: Request): string {
  try {
    return new URL(req.url).pathname;
  } catch {
    return req.url || "unknown";
  }
}

export function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    const extra: Record<string, unknown> = {
      name: err.name,
      message: err.message,
      stack: err.stack,
    };
    const code = (err as Error & { code?: unknown }).code;
    const digest = (err as Error & { digest?: unknown }).digest;
    if (code !== undefined) extra.code = code;
    if (digest !== undefined) extra.digest = digest;
    return extra;
  }
  if (err && typeof err === "object") {
    try {
      return { message: JSON.stringify(err) };
    } catch {
      return { message: String(err) };
    }
  }
  return { message: String(err) };
}

function fieldValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value.replace(/\s+/g, " ").slice(0, 500);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value).slice(0, 500);
  } catch {
    return String(value);
  }
}

/** Redact email to local***@domain for logs. */
export function redactEmail(email?: string | null): string | undefined {
  if (!email || !email.includes("@")) return email || undefined;
  const [local, domain] = email.split("@");
  const safeLocal = local.length <= 2 ? "***" : `${local.slice(0, 2)}***`;
  return `${safeLocal}@${domain}`;
}

/** Redact phone to last 4 digits. */
export function redactPhone(phone?: string | null): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `***${digits.slice(-4)}`;
}

export function formatServerLog(
  level: LogLevel,
  scope: string,
  message: string,
  fields?: Record<string, unknown>,
): string {
  const ctx = getRequestLogContext();
  const parts = [`[${level}]`, `scope=${scope}`];
  const method = fields?.method ?? ctx?.method;
  const path = fields?.path ?? ctx?.path;
  if (method) parts.push(`method=${method}`);
  if (path) parts.push(`path=${path}`);
  if (fields) {
    for (const [key, value] of Object.entries(fields)) {
      if (key === "method" || key === "path" || key === "cause" || value === undefined || value === "") {
        continue;
      }
      parts.push(`${key}=${fieldValue(value)}`);
    }
  }
  parts.push(`msg=${fieldValue(message)}`);
  return parts.join(" ");
}

export function logServer(
  level: LogLevel,
  scope: string,
  message: string,
  fields?: Record<string, unknown>,
  cause?: unknown,
) {
  if (!shouldLog(level)) return;
  const line = formatServerLog(level, scope, message, fields);
  if (level === "error") {
    if (cause !== undefined) console.error(line, serializeError(cause));
    else console.error(line);
    return;
  }
  if (level === "warn") {
    if (cause !== undefined) console.warn(line, serializeError(cause));
    else console.warn(line);
    return;
  }
  if (level === "debug") {
    if (cause !== undefined) console.debug(line, serializeError(cause));
    else console.debug(line);
    return;
  }
  if (cause !== undefined) console.info(line, serializeError(cause));
  else console.info(line);
}

export function logServerError(
  scope: string,
  message: string,
  fields?: Record<string, unknown>,
  cause?: unknown,
) {
  logServer("error", scope, message, fields, cause);
}

export function logServerWarn(
  scope: string,
  message: string,
  fields?: Record<string, unknown>,
  cause?: unknown,
) {
  logServer("warn", scope, message, fields, cause);
}

export function logServerInfo(
  scope: string,
  message: string,
  fields?: Record<string, unknown>,
  cause?: unknown,
) {
  logServer("info", scope, message, fields, cause);
}

export function logServerDebug(
  scope: string,
  message: string,
  fields?: Record<string, unknown>,
  cause?: unknown,
) {
  logServer("debug", scope, message, fields, cause);
}

export function logApiError(params: {
  message: string;
  status: number;
  code?: string;
  extra?: Record<string, unknown>;
  cause?: unknown;
}) {
  const ctx = getRequestLogContext();
  const level: LogLevel = params.status >= 500 ? "error" : "warn";
  logServer(
    level,
    ctx?.scope || "api",
    params.message,
    {
      status: params.status,
      code: params.code,
      ...params.extra,
    },
    params.cause,
  );
}
