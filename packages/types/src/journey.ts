import type { CustomerJourneyStatus, EOIStatus } from "./enums";

export function mapToJourneyStatus(params: {
  journeyStatus?: string | null;
  eoiStatus?: string | null;
  confirmationStatus?: string | null;
}): CustomerJourneyStatus {
  if (params.journeyStatus) {
    return params.journeyStatus as CustomerJourneyStatus;
  }
  const eoi = params.eoiStatus as EOIStatus | undefined;
  if (eoi === "APPROVED") return "APPROVED";
  if (eoi === "REJECTED") return "REJECTED";
  if (eoi === "CORRECTION_REQUESTED") return "CORRECTION_PENDING";
  if (eoi === "SUBMITTED" || eoi === "UNDER_REVIEW") return "SUBMITTED";
  if (eoi === "DRAFT") return "DRAFT";
  if (params.confirmationStatus === "PENDING") return "CONFIRMATION_PENDING";
  return "ACTIVE";
}

export function generateEOIReference(): string {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `EOI-${year}-${rand}`;
}
