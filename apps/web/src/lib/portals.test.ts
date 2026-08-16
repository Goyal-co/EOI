import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getPortalHomeHrefForHost,
  getPortalLoginHrefForHost,
  isPathRoutingHost,
  resolvePortalFromHost,
  rewritePathForPortal,
} from "@goyal/auth/portals";

const ORIGIN_KEYS = [
  "NEXT_PUBLIC_PARTNER_URL",
  "NEXT_PUBLIC_CUSTOMER_URL",
  "NEXT_PUBLIC_ADMIN_URL",
  "NEXT_PUBLIC_APP_URL",
  "NEXTAUTH_URL",
  "NEXT_PUBLIC_ROOT_DOMAIN",
] as const;

const saved: Record<string, string | undefined> = {};

function snapshotEnv() {
  for (const key of ORIGIN_KEYS) saved[key] = process.env[key];
}

function restoreEnv() {
  for (const key of ORIGIN_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
}

function setPortalEnv() {
  process.env.NEXT_PUBLIC_PARTNER_URL = "https://leads.partnergoyalco.com";
  process.env.NEXT_PUBLIC_CUSTOMER_URL = "https://customer.partnergoyalco.com";
  process.env.NEXT_PUBLIC_ADMIN_URL = "https://admin.partnergoyalco.com";
  process.env.NEXT_PUBLIC_APP_URL = "https://leads.partnergoyalco.com";
  process.env.NEXT_PUBLIC_ROOT_DOMAIN = "partnergoyalco.com";
}

beforeEach(snapshotEnv);
afterEach(restoreEnv);

describe("isPathRoutingHost", () => {
  it("treats localhost, IPs, and Vercel previews as path-based", () => {
    expect(isPathRoutingHost("localhost:3000")).toBe(true);
    expect(isPathRoutingHost("127.0.0.1")).toBe(true);
    expect(isPathRoutingHost("10.0.0.8:3000")).toBe(true);
    expect(isPathRoutingHost("eoi-cp-git-main-goyal.vercel.app")).toBe(true);
  });

  it("does not treat production subdomains as path-based", () => {
    expect(isPathRoutingHost("leads.partnergoyalco.com")).toBe(false);
  });
});

describe("resolvePortalFromHost", () => {
  it("returns null on Vercel preview even when portal URLs are set", () => {
    setPortalEnv();
    expect(resolvePortalFromHost("eoi-cp-abc.vercel.app")).toBeNull();
    expect(resolvePortalFromHost("localhost:3000")).toBeNull();
  });

  it("maps production hosts and forwarded hosts with ports", () => {
    setPortalEnv();
    expect(resolvePortalFromHost("leads.partnergoyalco.com")).toBe("partner");
    expect(resolvePortalFromHost("customer.partnergoyalco.com:443")).toBe("customer");
    expect(resolvePortalFromHost("admin.partnergoyalco.com, localhost")).toBe("admin");
  });

  it("maps subdomain from ROOT_DOMAIN when portal origin env is missing", () => {
    delete process.env.NEXT_PUBLIC_PARTNER_URL;
    delete process.env.NEXT_PUBLIC_CUSTOMER_URL;
    delete process.env.NEXT_PUBLIC_ADMIN_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = "partnergoyalco.com";
    expect(resolvePortalFromHost("leads.partnergoyalco.com")).toBe("partner");
    expect(resolvePortalFromHost("customer.partnergoyalco.com")).toBe("customer");
  });

  it("infers portal from Host when env URLs are unset (VM / changed domains)", () => {
    for (const key of ORIGIN_KEYS) delete process.env[key];
    expect(resolvePortalFromHost("leads.acme.internal")).toBe("partner");
    expect(resolvePortalFromHost("customer.acme.internal")).toBe("customer");
    expect(resolvePortalFromHost("admin.acme.internal")).toBe("admin");
    expect(resolvePortalFromHost("eoi.acme.internal")).toBeNull();
    expect(resolvePortalFromHost("portal.company.com")).toBeNull();
  });
});

describe("rewritePathForPortal", () => {
  it("prefixes portal home for bare paths", () => {
    expect(rewritePathForPortal("/", "partner")).toBe("/partner");
    expect(rewritePathForPortal("/leads", "partner")).toBe("/partner/leads");
    expect(rewritePathForPortal("/login", "partner")).toBe("/partner/login");
    expect(rewritePathForPortal("/login", "customer")).toBe("/customer/login");
    expect(rewritePathForPortal("/login", "admin")).toBe("/login");
  });

  it("leaves already-prefixed and shared paths alone", () => {
    expect(rewritePathForPortal("/partner/leads", "partner")).toBe("/partner/leads");
    expect(rewritePathForPortal("/api/health", "partner")).toBe("/api/health");
    expect(rewritePathForPortal("/confirm/abc", "customer")).toBe("/confirm/abc");
  });
});

describe("getPortalHomeHrefForHost", () => {
  it("stays relative on preview and same portal", () => {
    setPortalEnv();
    expect(getPortalHomeHrefForHost("partner", "eoi.vercel.app")).toBe("/partner");
    expect(getPortalHomeHrefForHost("partner", "leads.partnergoyalco.com")).toBe("/partner");
  });

  it("uses the other portal origin when crossing subdomains", () => {
    setPortalEnv();
    expect(getPortalHomeHrefForHost("customer", "leads.partnergoyalco.com")).toBe(
      "https://customer.partnergoyalco.com/customer",
    );
    expect(getPortalLoginHrefForHost("admin", "leads.partnergoyalco.com")).toBe(
      "https://admin.partnergoyalco.com/login",
    );
  });

  it("builds sibling portal URLs from the request host when env is empty", () => {
    for (const key of ORIGIN_KEYS) delete process.env[key];
    expect(getPortalHomeHrefForHost("customer", "leads.vm.example")).toBe(
      "https://customer.vm.example/customer",
    );
    expect(getPortalHomeHrefForHost("partner", "10.0.0.8:3000")).toBe("/partner");
  });
});
