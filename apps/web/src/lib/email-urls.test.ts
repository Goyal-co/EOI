import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getCustomerConfirmUrl,
  getCustomerEoiUrl,
  getCustomerLoginUrl,
  getCustomerPortalUrl,
  getCustomerResetPasswordUrl,
} from "@goyal/email";

const KEYS = [
  "VERCEL_ENV",
  "VERCEL_URL",
  "APP_URL",
  "PUBLIC_URL",
  "NEXTAUTH_URL",
  "PARTNER_URL",
  "CUSTOMER_URL",
  "ADMIN_URL",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_PARTNER_URL",
  "NEXT_PUBLIC_CUSTOMER_URL",
  "NEXT_PUBLIC_ADMIN_URL",
  "ROOT_DOMAIN",
  "NEXT_PUBLIC_ROOT_DOMAIN",
] as const;

const saved: Record<string, string | undefined> = {};

function snapshotEnv() {
  for (const key of KEYS) saved[key] = process.env[key];
  for (const key of KEYS) delete process.env[key];
}

function restoreEnv() {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
}

beforeEach(snapshotEnv);
afterEach(restoreEnv);

describe("customer email URLs", () => {
  it("uses CUSTOMER_URL with public paths on the customer host", () => {
    process.env.APP_URL = "https://leads.partnergoyalco.com";
    process.env.CUSTOMER_URL = "https://customer.partnergoyalco.com";

    expect(getCustomerLoginUrl()).toBe("https://customer.partnergoyalco.com/login");
    expect(getCustomerPortalUrl()).toBe("https://customer.partnergoyalco.com/");
    expect(getCustomerEoiUrl()).toBe("https://customer.partnergoyalco.com/eoi");
    expect(getCustomerResetPasswordUrl("abc")).toBe(
      "https://customer.partnergoyalco.com/reset-password/abc",
    );
    expect(getCustomerConfirmUrl("tok", "accept")).toBe(
      "https://customer.partnergoyalco.com/confirm/tok/accept",
    );
  });

  it("does not fall back to the partner host when ROOT_DOMAIN is set", () => {
    process.env.APP_URL = "https://leads.partnergoyalco.com";
    process.env.ROOT_DOMAIN = "partnergoyalco.com";

    expect(getCustomerLoginUrl()).toBe("https://customer.partnergoyalco.com/login");
    expect(getCustomerConfirmUrl("tok", "reject")).toBe(
      "https://customer.partnergoyalco.com/confirm/tok/reject",
    );
  });

  it("keeps /customer paths on localhost path routing", () => {
    process.env.APP_URL = "http://localhost:3000";

    expect(getCustomerLoginUrl()).toBe("http://localhost:3000/customer/login");
    expect(getCustomerPortalUrl()).toBe("http://localhost:3000/customer");
    expect(getCustomerConfirmUrl("tok", "accept")).toBe(
      "http://localhost:3000/confirm/tok/accept",
    );
  });
});
