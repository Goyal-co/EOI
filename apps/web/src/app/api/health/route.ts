import { prisma } from "@goyal/db";
import { apiResponse } from "@/lib/api";
import Redis from "ioredis";
import { getStorageMode } from "@/lib/storage/provider";
import { blobHealthCheck } from "@/lib/storage/vercel-blob";
import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";

export async function GET() {
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
  } else if (storageMode === "s3" && process.env.S3_ACCESS_KEY) {
    try {
      const s3 = new S3Client({
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION || "us-east-1",
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY,
          secretAccessKey: process.env.S3_SECRET_KEY || "",
        },
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      });
      await s3.send(new HeadBucketCommand({ Bucket: process.env.S3_BUCKET || "goyal-eoi-documents" }));
      checks.storage = true;
    } catch {
      checks.storage = false;
    }
  } else {
    checks.storage = process.env.NODE_ENV !== "production";
  }

  if (process.env.REDIS_URL) {
    const redis = new Redis(process.env.REDIS_URL, {
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
    { status: ok ? "ok" : "degraded", checks, timestamp: new Date().toISOString() },
    ok ? 200 : 503
  );
}
