import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getStorageMode } from "./provider";

const KEYS = ["S3_ACCESS_KEY", "BLOB_READ_WRITE_TOKEN", "NODE_ENV"] as const;
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

describe("getStorageMode", () => {
  it("uses S3 for all documents when S3 credentials exist, even if blob token is set", () => {
    process.env.S3_ACCESS_KEY = "AKIATEST";
    process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_test";
    process.env.NODE_ENV = "development";
    expect(getStorageMode()).toBe("s3");
  });
});
