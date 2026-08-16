import { prisma } from "@goyal/db";
import { apiResponse } from "@/lib/api";
import Redis from "ioredis";
import { getRedisUrl } from "@/lib/redis";
import { getStorageMode } from "@/lib/storage/provider";
import { blobHealthCheck } from "@/lib/storage/vercel-blob";
import { s3HealthCheck } from "@/lib/storage/s3";

export async function GET(req: Request) {
  const live = new URL(req.url).searchParams.get("live") === "1";
  if (live) {
    return apiResponse({ status: "ok", live: true, timestamp: new Date().toISOString() });
  }
  const checks: Record<string, boolean> = { database: false, storage: false, redis: false };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch {
    checks.database = false;
  }

  const storageMode = getStorageMode();
  if (storageMode === "blob") {
    checks.storage = await blobHealthCheck();
  } else if (storageMode === "s3") {
    checks.storage = await s3HealthCheck();
  } else {
    checks.storage = process.env.NODE_ENV !== "production";
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
    } catch {
      checks.redis = false;
    } finally {
      redis.disconnect();
    }
  } else {
    checks.redis = process.env.NODE_ENV !== "production";
  }

  const ok = checks.database && checks.storage && checks.redis;
  return apiResponse(
    {
      status: ok ? "ok" : "degraded",
      checks,
      punch: "v4",
      gitSha: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || null,
      timestamp: new Date().toISOString(),
    },
    ok ? 200 : 503
  );
}
