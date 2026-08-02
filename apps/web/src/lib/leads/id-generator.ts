export function generatePublicLeadId(intentType: "EOI" | "LEAD_ONLY", projectCode: string, seq: number) {
  const prefix = intentType === "EOI" ? "EOI" : "LEAD";
  const code = projectCode.replace(/[^A-Z0-9]/gi, "").slice(0, 6).toUpperCase() || "PRJ";
  return `${prefix}-${code}-${String(seq).padStart(6, "0")}`;
}
