import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  canonicalizeEmailUrl,
  getAdminLeadsUrl,
  getCustomerConfirmUrl,
  getCustomerEoiUrl,
  getCustomerLoginUrl,
  getCustomerPortalUrl,
  getCustomerResetPasswordUrl,
  getPartnerLeadsUrl,
  getPartnerLoginUrl,
  getPartnerResetPasswordUrl,
  rewriteEmailHtmlUrls,
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
  "NODE_ENV",
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

  it("infers the customer host from APP_URL alone", () => {
    process.env.APP_URL = "https://leads.partnergoyalco.com";

    expect(getCustomerLoginUrl()).toBe("https://customer.partnergoyalco.com/login");
    expect(getCustomerConfirmUrl("tok", "accept")).toBe(
      "https://customer.partnergoyalco.com/confirm/tok/accept",
    );
    expect(getPartnerLoginUrl()).toBe("https://leads.partnergoyalco.com/login");
    expect(getPartnerLeadsUrl("LD-1")).toBe(
      "https://leads.partnergoyalco.com/leads?search=LD-1",
    );
    expect(getAdminLeadsUrl("LD-1")).toBe(
      "https://admin.partnergoyalco.com/leads?q=LD-1",
    );
  });

  it("keeps /customer paths on localhost path routing", () => {
    process.env.APP_URL = "http://localhost:3000";

    expect(getCustomerLoginUrl()).toBe("http://localhost:3000/customer/login");
    expect(getCustomerPortalUrl()).toBe("http://localhost:3000/customer");
    expect(getCustomerConfirmUrl("tok", "accept")).toBe(
      "http://localhost:3000/confirm/tok/accept",
    );
    expect(getPartnerLoginUrl()).toBe("http://localhost:3000/partner/login");
    expect(getPartnerResetPasswordUrl("tok")).toBe(
      "http://localhost:3000/partner/reset-password/tok",
    );
  });

  it("never emails localhost in production even if APP_URL is local", () => {
    process.env.NODE_ENV = "production";
    process.env.APP_URL = "http://localhost:3000";
    process.env.NEXTAUTH_URL = "http://localhost:3000";

    expect(getPartnerLoginUrl()).toBe("https://leads.partnergoyalco.com/login");
    expect(getCustomerConfirmUrl("tok", "accept")).toBe(
      "https://customer.partnergoyalco.com/confirm/tok/accept",
    );
    expect(getCustomerLoginUrl()).toBe("https://customer.partnergoyalco.com/login");
    expect(getCustomerEoiUrl()).toBe("https://customer.partnergoyalco.com/eoi");
  });
});

describe("canonicalizeEmailUrl", () => {
  it("rewrites localhost CP login and leads confirm links", () => {
    process.env.APP_URL = "https://leads.partnergoyalco.com";
    process.env.CUSTOMER_URL = "https://customer.partnergoyalco.com";

    expect(canonicalizeEmailUrl("http://localhost:3000/partner/login")).toBe(
      "https://leads.partnergoyalco.com/login",
    );
    expect(canonicalizeEmailUrl("http://localhost:3000/confirm/tok/accept")).toBe(
      "https://customer.partnergoyalco.com/confirm/tok/accept",
    );
    expect(canonicalizeEmailUrl("https://leads.partnergoyalco.com/confirm/tok/accept")).toBe(
      "https://customer.partnergoyalco.com/confirm/tok/accept",
    );
    expect(canonicalizeEmailUrl("https://leads.partnergoyalco.com/customer/login")).toBe(
      "https://customer.partnergoyalco.com/login",
    );
    expect(canonicalizeEmailUrl("https://leads.partnergoyalco.com/reset-password/tok")).toBe(
      "https://leads.partnergoyalco.com/reset-password/tok",
    );
  });

  it("rewrites hardcoded localhost URLs inside stored HTML templates", () => {
    process.env.APP_URL = "https://leads.partnergoyalco.com";
    process.env.CUSTOMER_URL = "https://customer.partnergoyalco.com";

    const html = `
      <a href="http://localhost:3000/partner/login">Login</a>
      <a href="https://leads.partnergoyalco.com/confirm/abc/accept">Accept</a>
    `;
    const rewritten = rewriteEmailHtmlUrls(html);
    expect(rewritten).toContain("https://leads.partnergoyalco.com/login");
    expect(rewritten).not.toContain("localhost");
    expect(rewritten).toContain("https://customer.partnergoyalco.com/confirm/abc/accept");
    expect(rewritten).not.toContain("https://leads.partnergoyalco.com/confirm");
  });
});
