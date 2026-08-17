import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { overallHealthMeta } from "./health-check";

const KEYS = [
  "ROOT_DOMAIN",
  "NEXT_PUBLIC_ROOT_DOMAIN",
  "APP_URL",
  "PARTNER_URL",
  "CUSTOMER_URL",
  "ADMIN_URL",
  "NEXT_PUBLIC_PARTNER_URL",
  "NEXT_PUBLIC_CUSTOMER_URL",
  "NEXT_PUBLIC_ADMIN_URL",
  "NEXTAUTH_URL",
] as const;

const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  process.env.ROOT_DOMAIN = "partnergoyalco.com";
  process.env.APP_URL = "https://leads.partnergoyalco.com";
  process.env.PARTNER_URL = "https://leads.partnergoyalco.com";
  process.env.CUSTOMER_URL = "https://customer.partnergoyalco.com";
  process.env.ADMIN_URL = "https://admin.partnergoyalco.com";
});

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("overallHealthMeta", () => {
  it("reports the root domain and all portal URLs", () => {
    const req = new Request("https://partnergoyalco.com/api/health", {
      headers: { host: "partnergoyalco.com" },
    });
    expect(overallHealthMeta(req)).toEqual({
      overall: true,
      domain: "partnergoyalco.com",
      host: "partnergoyalco.com",
      portals: {
        root: "https://partnergoyalco.com",
        partner: "https://leads.partnergoyalco.com",
        customer: "https://customer.partnergoyalco.com",
        admin: "https://admin.partnergoyalco.com",
      },
    });
  });
});
