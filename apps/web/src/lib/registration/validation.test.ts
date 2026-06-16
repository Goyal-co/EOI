import { describe, expect, it } from "vitest";
import { cpRegisterStep1Schema, cpRegisterStep2Schema } from "@goyal/types";
import { isRegistrationStepValid, getRegistrationStepHints } from "./validation";

describe("registration validation", () => {
  const validStep1 = {
    fullName: "Rajesh Sharma",
    mobile: "9876543210",
    email: "partner@example.com",
    password: "Partner@123",
    confirmPassword: "Partner@123",
  };

  const validStep2 = {
    companyName: "Test Realty",
    reraNumber: "P52100012345",
    panNumber: "ABCDE1234F",
    gstNumber: "",
  };

  it("accepts valid step 1 and step 2", () => {
    expect(isRegistrationStepValid(0, validStep1, validStep2)).toBe(true);
    expect(isRegistrationStepValid(1, validStep1, validStep2)).toBe(true);
  });

  it("rejects invalid PAN on step 2", () => {
    expect(isRegistrationStepValid(1, validStep1, { ...validStep2, panNumber: "abc" })).toBe(false);
    const hints = getRegistrationStepHints(1, validStep1, { ...validStep2, panNumber: "abc" });
    expect(hints.some((h) => h.includes("PAN"))).toBe(true);
  });

  it("normalizes email in schema", () => {
    const parsed = cpRegisterStep1Schema.parse({
      ...validStep1,
      email: "  Partner@Example.COM  ",
    });
    expect(parsed.email).toBe("partner@example.com");
  });

  it("validates step 2 via zod", () => {
    expect(cpRegisterStep2Schema.safeParse(validStep2).success).toBe(true);
    expect(cpRegisterStep2Schema.safeParse({ ...validStep2, reraNumber: "123" }).success).toBe(false);
  });
});
