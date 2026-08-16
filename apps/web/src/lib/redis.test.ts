import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getRedisUrl, useLocalRedis } from "./redis";

const KEYS = [
  "REDIS_URL",
  "REDIS_URL_LOCAL",
  "REDIS_ENV",
  "NODE_ENV",
  "VERCEL_ENV",
  "NEXTAUTH_URL",
  "APP_URL",
  "NEXT_PUBLIC_APP_URL",
] as const;

const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of KEYS) saved[key] = process.env[key];
});

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("getRedisUrl", () => {
  it("uses REDIS_URL_LOCAL on localhost even if REDIS_URL is production", () => {
    process.env.NODE_ENV = "development";
    process.env.NEXTAUTH_URL = "http://localhost:3000";
    process.env.REDIS_URL_LOCAL = "redis://localhost:6379";
    process.env.REDIS_URL = "rediss://prod.example:6379";
    expect(useLocalRedis()).toBe(true);
    expect(getRedisUrl()).toBe("redis://localhost:6379");
  });

  it("falls back to REDIS_URL locally when REDIS_URL_LOCAL is unset", () => {
    process.env.NODE_ENV = "development";
    process.env.NEXTAUTH_URL = "http://localhost:3000";
    delete process.env.REDIS_URL_LOCAL;
    process.env.REDIS_URL = "redis://default:local@upstash:6379";
    expect(getRedisUrl()).toBe("redis://default:local@upstash:6379");
  });

  it("uses REDIS_URL in production and ignores REDIS_URL_LOCAL", () => {
    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "production";
    process.env.NEXTAUTH_URL = "https://leads.example.com";
    process.env.REDIS_URL_LOCAL = "redis://localhost:6379";
    process.env.REDIS_URL = "rediss://prod.example:6379";
    expect(useLocalRedis()).toBe(false);
    expect(getRedisUrl()).toBe("rediss://prod.example:6379");
  });
});
