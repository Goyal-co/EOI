type RateLimitEntry = { count: number; resetAt: number };

const store = new Map<string, RateLimitEntry>();

let redisClient: import("ioredis").default | null = null;
let redisInitFailed = false;

async function getRedis(): Promise<import("ioredis").default | null> {
  if (redisInitFailed || !process.env.REDIS_URL) return null;
  if (redisClient) return redisClient;
  try {
    const Redis = (await import("ioredis")).default;
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    await redisClient.connect();
    return redisClient;
  } catch {
    redisInitFailed = true;
    return null;
  }
}

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (entry.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count += 1;
  return { ok: true };
}

export async function rateLimitAsync(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ ok: boolean; retryAfter?: number }> {
  const redis = await getRedis();
  if (redis) {
    try {
      const count = await redis.incr(key);
      if (count === 1) await redis.pexpire(key, windowMs);
      if (count > limit) {
        const ttl = await redis.pttl(key);
        return { ok: false, retryAfter: Math.ceil(Math.max(ttl, 0) / 1000) };
      }
      return { ok: true };
    } catch {
      return rateLimit(key, limit, windowMs);
    }
  }
  return rateLimit(key, limit, windowMs);
}

export function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}
