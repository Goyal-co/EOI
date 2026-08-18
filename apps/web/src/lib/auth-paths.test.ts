import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isShellAuthPath } from "./auth-paths";

describe("isShellAuthPath", () => {
  it("skips customer login on both rewritten and app paths", () => {
    const prefixes = ["/customer/login", "/customer/welcome", "/customer/forgot-password", "/customer/reset-password"];
    expect(isShellAuthPath("/customer/login", prefixes)).toBe(true);
    expect(isShellAuthPath("/login", prefixes)).toBe(true);
    expect(isShellAuthPath("/welcome", prefixes)).toBe(true);
    expect(isShellAuthPath("/forgot-password", prefixes)).toBe(true);
    expect(isShellAuthPath("/reset-password/abc", prefixes)).toBe(true);
    expect(isShellAuthPath("/customer/eoi", prefixes)).toBe(false);
    expect(isShellAuthPath("/customer", prefixes)).toBe(false);
  });

  it("skips partner auth pages on the partner host short paths", () => {
    const prefixes = ["/partner/login", "/partner/register", "/partner/forgot-password"];
    expect(isShellAuthPath("/login", prefixes)).toBe(true);
    expect(isShellAuthPath("/register", prefixes)).toBe(true);
    expect(isShellAuthPath("/partner/leads", prefixes)).toBe(false);
  });
});
