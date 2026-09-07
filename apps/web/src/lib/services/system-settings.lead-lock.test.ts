import { describe, expect, it } from "vitest";
import {
  normalizeEoiRulesLeadLock,
  parseLeadLockPolicyFromRules,
  SYSTEM_SETTINGS_DEFAULTS,
} from "@/lib/services/system-settings";

describe("parseLeadLockPolicyFromRules", () => {
  it("uses defaults when fields are missing", () => {
    expect(parseLeadLockPolicyFromRules({})).toEqual({
      enabled: true,
      lockDays: 15,
      cooldownDays: 7,
    });
  });

  it("respects disabled toggle", () => {
    expect(
      parseLeadLockPolicyFromRules({ leadPunchBlockingEnabled: false }),
    ).toMatchObject({ enabled: false });
  });

  it("clamps lock days to 1–90 and cooldown to 0–90", () => {
    expect(
      parseLeadLockPolicyFromRules({
        leadPunchBlockingEnabled: true,
        leadLockDays: "0",
        leadCooldownDays: "999",
      }),
    ).toEqual({ enabled: true, lockDays: 1, cooldownDays: 90 });

    expect(
      parseLeadLockPolicyFromRules({
        leadLockDays: "30",
        leadCooldownDays: "0",
      }),
    ).toEqual({ enabled: true, lockDays: 30, cooldownDays: 0 });
  });

  it("falls back on invalid strings", () => {
    expect(
      parseLeadLockPolicyFromRules({
        leadLockDays: "abc",
        leadCooldownDays: "",
      }),
    ).toEqual({ enabled: true, lockDays: 15, cooldownDays: 7 });
  });
});

describe("normalizeEoiRulesLeadLock", () => {
  it("persists clamped string values", () => {
    const next = normalizeEoiRulesLeadLock({
      ...SYSTEM_SETTINGS_DEFAULTS.eoiRules,
      leadPunchBlockingEnabled: true,
      leadLockDays: "120",
      leadCooldownDays: "-3",
    });
    expect(next.leadLockDays).toBe("90");
    expect(next.leadCooldownDays).toBe("7");
  });
});
