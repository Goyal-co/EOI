export type LeadIntentType = "EOI" | "LEAD_ONLY";
export type ProjectEoiStatus = "OPEN" | "CLOSED";

export function resolveLeadIntent(
  projectEoiStatus: ProjectEoiStatus,
  requested?: LeadIntentType,
): { intentType: LeadIntentType } | { error: string; status: number } {
  let intentType = requested ?? (projectEoiStatus === "CLOSED" ? "LEAD_ONLY" : "EOI");

  if (projectEoiStatus === "CLOSED") {
    if (intentType === "EOI") {
      return { error: "EOI submission is closed for this project. Use Punch Lead instead.", status: 400 };
    }
    intentType = "LEAD_ONLY";
  } else if (intentType === "LEAD_ONLY") {
    return { error: "Lead-only punching is only available for EOI closed projects", status: 400 };
  }

  if (intentType === "EOI" && projectEoiStatus !== "OPEN") {
    return { error: "EOI is closed for this project", status: 400 };
  }

  return { intentType };
}

export function journeyStatusOnLeadOnlyAccept(): "LEAD_CONFIRMED" {
  return "LEAD_CONFIRMED";
}
