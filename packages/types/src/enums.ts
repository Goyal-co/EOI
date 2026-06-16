export const UserRole = {
  ADMIN: "ADMIN",
  CHANNEL_PARTNER: "CHANNEL_PARTNER",
  CUSTOMER: "CUSTOMER",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const UserStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  PENDING: "PENDING",
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const CPStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  BLOCKED: "BLOCKED",
} as const;
export type CPStatus = (typeof CPStatus)[keyof typeof CPStatus];

export const ProjectEOIStatus = {
  OPEN: "OPEN",
  CLOSED: "CLOSED",
} as const;
export type ProjectEOIStatus = (typeof ProjectEOIStatus)[keyof typeof ProjectEOIStatus];

export const ProjectStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  UPCOMING: "UPCOMING",
} as const;
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

export const CustomerJourneyStatus = {
  ACTIVE: "ACTIVE",
  CONFIRMATION_PENDING: "CONFIRMATION_PENDING",
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CORRECTION_PENDING: "CORRECTION_PENDING",
  LEAD_CONFIRMED: "LEAD_CONFIRMED",
} as const;
export type CustomerJourneyStatus = (typeof CustomerJourneyStatus)[keyof typeof CustomerJourneyStatus];

export const LeadIntent = {
  EOI: "EOI",
  LEAD_ONLY: "LEAD_ONLY",
} as const;
export type LeadIntent = (typeof LeadIntent)[keyof typeof LeadIntent];

export const ConfirmationStatus = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
} as const;
export type ConfirmationStatus = (typeof ConfirmationStatus)[keyof typeof ConfirmationStatus];

export const LeadStatus = {
  LEAD_REGISTERED: "LEAD_REGISTERED",
  CUSTOMER_PENDING: "CUSTOMER_PENDING",
  EOI_SUBMITTED: "EOI_SUBMITTED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;
export type LeadStatus = (typeof LeadStatus)[keyof typeof LeadStatus];

export const SiteVisitStatus = {
  NOT_SCHEDULED: "NOT_SCHEDULED",
  SCHEDULED: "SCHEDULED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;
export type SiteVisitStatus = (typeof SiteVisitStatus)[keyof typeof SiteVisitStatus];

export const EOIStatus = {
  PENDING_SUBMISSION: "PENDING_SUBMISSION",
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  UNDER_REVIEW: "UNDER_REVIEW",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CORRECTION_REQUESTED: "CORRECTION_REQUESTED",
  CLOSED: "CLOSED",
} as const;
export type EOIStatus = (typeof EOIStatus)[keyof typeof EOIStatus];

export const DocumentType = {
  CHEQUE: "CHEQUE",
  PAN: "PAN",
  AADHAAR: "AADHAAR",
  RERA_CERT: "RERA_CERT",
  VISITING_CARD: "VISITING_CARD",
  BROCHURE: "BROCHURE",
  COST_SHEET: "COST_SHEET",
  FLOOR_PLAN: "FLOOR_PLAN",
  GALLERY: "GALLERY",
  BANNER: "BANNER",
} as const;
export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];

export const DocumentStatus = {
  PENDING: "PENDING",
  VERIFIED: "VERIFIED",
  REJECTED: "REJECTED",
} as const;
export type DocumentStatus = (typeof DocumentStatus)[keyof typeof DocumentStatus];

export const ApprovalActionType = {
  APPROVE: "APPROVE",
  REJECT: "REJECT",
  REQUEST_CORRECTION: "REQUEST_CORRECTION",
} as const;
export type ApprovalActionType = (typeof ApprovalActionType)[keyof typeof ApprovalActionType];

export const NotificationType = {
  NEW_EOI_SUBMITTED: "NEW_EOI_SUBMITTED",
  APPROVAL_PENDING: "APPROVAL_PENDING",
  CP_REGISTERED: "CP_REGISTERED",
  CORRECTION_REQUESTED: "CORRECTION_REQUESTED",
  PROJECT_STATUS_UPDATED: "PROJECT_STATUS_UPDATED",
  EOI_APPROVED: "EOI_APPROVED",
  EOI_REJECTED: "EOI_REJECTED",
  EOI_INVITATION: "EOI_INVITATION",
  CUSTOMER_SUBMITTED_EOI: "CUSTOMER_SUBMITTED_EOI",
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const EOI_TRANSITIONS: Record<EOIStatus, EOIStatus[]> = {
  PENDING_SUBMISSION: ["DRAFT"],
  DRAFT: ["DRAFT", "SUBMITTED"],
  SUBMITTED: ["UNDER_REVIEW", "APPROVED", "REJECTED", "CORRECTION_REQUESTED"],
  UNDER_REVIEW: ["APPROVED", "REJECTED", "CORRECTION_REQUESTED"],
  APPROVED: ["CLOSED"],
  REJECTED: [],
  CORRECTION_REQUESTED: ["DRAFT", "SUBMITTED"],
  CLOSED: [],
};

export function canTransitionEOI(from: EOIStatus, to: EOIStatus): boolean {
  return EOI_TRANSITIONS[from]?.includes(to) ?? false;
}
