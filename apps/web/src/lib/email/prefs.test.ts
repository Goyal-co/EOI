import { describe, expect, it } from "vitest";
import { isTransactionalEmailType } from "@goyal/email";

describe("email notification prefs", () => {
  it("treats customer submit email as transactional", () => {
    expect(isTransactionalEmailType("EOI_SUBMITTED")).toBe(true);
  });

  it("does not treat admin new-eoi in-app type as transactional email", () => {
    expect(isTransactionalEmailType("NEW_EOI_SUBMITTED")).toBe(false);
  });

  it("treats CP onboarding emails as transactional", () => {
    expect(isTransactionalEmailType("CP_REGISTRATION_ACK")).toBe(true);
    expect(isTransactionalEmailType("CP_APPROVED")).toBe(true);
  });
});
