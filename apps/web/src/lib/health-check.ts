import { NextResponse } from "next/server";
import { prisma } from "@goyal/db";
import Redis from "ioredis";
import { getPortalOrigins } from "@goyal/auth/portals";
import { getRedisUrl } from "@/lib/redis";
import { getStorageMode } from "@/lib/storage/provider";
import { blobHealthCheck } from "@/lib/storage/vercel-blob";
import { s3HealthCheck } from "@/lib/storage/s3";
import { logServerWarn } from "@/lib/server-log";

export type HealthPayload = {
  status: "ok" | "degraded";
  live?: boolean;
  overall?: boolean;
  domain?: string;
  host?: string;
  portals?: {
    root: string;
    partner: string;
    customer: string;
    admin: string;
  };
  checks?: Record<string, boolean>;
  punch?: string;
  gitSha?: string | null;
  timestamp: string;
};

function requestHost(req: Request): string {
  const raw = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  return raw.split(",")[0].trim().toLowerCase();
}

function configuredRootDomain(): string {
  return (process.env.ROOT_DOMAIN || process.env.NEXT_PUBLIC_ROOT_DOMAIN || "partnergoyalco.com")
    .replace(/^\./, "")
    .toLowerCase()
    .trim();
}

function publicScheme(): string {
  const from =
    process.env.APP_URL
    || process.env.PUBLIC_URL
    || process.env.NEXTAUTH_URL
    || process.env.PARTNER_URL
    || process.env.CUSTOMER_URL;
  try {
    if (from?.trim()) return new URL(from.trim()).protocol.replace(":", "") || "https";
  } catch {
    /* ignore invalid URL */
  }
  return "https";
}

export function overallHealthMeta(req: Request): {
  overall: true;
  domain: string;
  host: string;
  portals: { root: string; partner: string; customer: string; admin: string };
} {
  const domain = configuredRootDomain();
  const scheme = publicScheme();
  const origins = getPortalOrigins();
  const fallback = (label: string, configured: string | null) =>
    configured || `${scheme}://${label}.${domain}`;

  return {
    overall: true,
    domain,
    host: requestHost(req) || domain,
    portals: {
      root: `${scheme}://${domain}`,
      partner: fallback("leads", origins.partner),
      customer: fallback("customer", origins.customer),
      admin: fallback("admin", origins.admin),
    },
  };
}

const HEALTH_HEADERS = {
  "cache-control": "no-store",
  "access-control-allow-origin": "*",
};

export async function runHealthCheck(
  req: Request,
  options?: { overall?: boolean },
): Promise<NextResponse<HealthPayload>> {
  const url = new URL(req.url);
  const live = url.searchParams.get("live") === "1";
  const overall = options?.overall === true;
  const meta = overall ? overallHealthMeta(req) : undefined;

  if (live) {
    return NextResponse.json(
      {
        status: "ok",
        live: true,
        ...(meta || {}),
        timestamp: new Date().toISOString(),
      },
      { status: 200, headers: HEALTH_HEADERS },
    );
  }

  const checks: Record<string, boolean> = { database: false, storage: false, redis: false };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch (cause) {
    checks.database = false;
    logServerWarn("health", "Database check failed", { check: "database" }, cause);
  }

  const storageMode = getStorageMode();
  if (storageMode === "blob") {
    checks.storage = await blobHealthCheck();
  } else if (storageMode === "s3") {
    checks.storage = await s3HealthCheck();
  } else {
    checks.storage = process.env.NODE_ENV !== "production";
  }
  if (!checks.storage) {
    logServerWarn("health", "Storage check failed", { check: "storage", mode: storageMode });
  }

  const redisUrl = getRedisUrl();
  if (redisUrl) {
    const redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      lazyConnect: true,
    });
    try {
      await redis.connect();
      await redis.ping();
      checks.redis = true;
    } catch (cause) {
      checks.redis = false;
      logServerWarn("health", "Redis check failed", { check: "redis" }, cause);
    } finally {
      redis.disconnect();
    }
  } else {
    checks.redis = process.env.NODE_ENV !== "production";
  }

  const ok = checks.database && checks.storage && checks.redis;
  return NextResponse.json(
    {
      status: ok ? "ok" : "degraded",
      ...(meta || {}),
      checks,
      punch: "v4",
      gitSha: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || null,
      timestamp: new Date().toISOString(),
    },
    { status: ok ? 200 : 503, headers: HEALTH_HEADERS },
  );
}

export async function healthHeadResponse(
  req: Request,
  options?: { overall?: boolean },
): Promise<Response> {
  const res = await runHealthCheck(req, options);
  return new Response(null, { status: res.status, headers: HEALTH_HEADERS });
}
