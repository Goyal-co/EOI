import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { appFileUrl, getS3Prefix, withS3Prefix } from "./s3";

const KEYS = ["S3_PREFIX", "S3_BUCKET"] as const;
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

describe("S3 prefix", () => {
  it("defaults to eoi and never writes to bucket root", () => {
    delete process.env.S3_PREFIX;
    expect(getS3Prefix()).toBe("eoi");
    expect(withS3Prefix("admin/user1/banner.jpg")).toBe("eoi/admin/user1/banner.jpg");
  });

  it("does not double-prefix keys", () => {
    process.env.S3_PREFIX = "eoi";
    expect(withS3Prefix("eoi/admin/file.pdf")).toBe("eoi/admin/file.pdf");
  });

  it("builds a same-origin file URL for the app, not S3", () => {
    process.env.S3_PREFIX = "eoi";
    expect(appFileUrl("admin/u1/pan/file.pdf")).toBe("/api/files/eoi/admin/u1/pan/file.pdf");
  });
});
