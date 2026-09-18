import { randomInt } from "crypto";

export function generatePublicLeadId(intentType: "EOI" | "LEAD_ONLY", projectCode: string, seq: number) {
  const prefix = intentType === "EOI" ? "EOI" : "LEAD";
  const code = projectCode.replace(/[^A-Z0-9]/gi, "").slice(0, 6).toUpperCase() || "PRJ";
  // 8-digit seq reduces collisions vs 6-digit + Date.now()%1e6 races
  return `${prefix}-${code}-${String(Math.abs(seq) % 100_000_000).padStart(8, "0")}`;
}

/** High-entropy public id for concurrent punches (avoids LeadIdentity.leadId P2002). */
export function generateUniquePublicLeadId(
  intentType: "EOI" | "LEAD_ONLY",
  projectCode: string,
  attempt = 0,
) {
  const prefix = intentType === "EOI" ? "EOI" : "LEAD";
  const code = projectCode.replace(/[^A-Z0-9]/gi, "").slice(0, 6).toUpperCase() || "PRJ";
  const timePart = Date.now().toString(36).toUpperCase().slice(-6);
  const randPart = randomInt(0, 36 ** 4)
    .toString(36)
    .toUpperCase()
    .padStart(4, "0");
  const attemptPart = attempt > 0 ? String(attempt).padStart(2, "0") : "";
  return `${prefix}-${code}-${timePart}${randPart}${attemptPart}`;
}
