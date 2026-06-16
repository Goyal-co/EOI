import { Badge } from "./badge";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "gold" | "success" | "warning" | "error" | "outline" }> = {
  ACTIVE: { label: "Active", variant: "outline" },
  CONFIRMATION_PENDING: { label: "Confirmation Pending", variant: "warning" },
  DRAFT: { label: "Draft", variant: "outline" },
  SUBMITTED: { label: "Submitted", variant: "default" },
  APPROVED: { label: "Approved", variant: "success" },
  REJECTED: { label: "Rejected", variant: "error" },
  CORRECTION_PENDING: { label: "Correction Pending", variant: "warning" },
  PENDING_SUBMISSION: { label: "Pending Submission", variant: "outline" },
  UNDER_REVIEW: { label: "Under Review", variant: "warning" },
  CORRECTION_REQUESTED: { label: "Correction Requested", variant: "warning" },
  CLOSED: { label: "Closed", variant: "gold" },
  OPEN: { label: "EOI Open", variant: "success" },
  CLOSED_PROJECT: { label: "EOI Closed", variant: "error" },
  PENDING: { label: "Pending", variant: "warning" },
  BLOCKED: { label: "Blocked", variant: "error" },
  ACCEPTED: { label: "Accepted", variant: "success" },
  NOT_SCHEDULED: { label: "Not Scheduled", variant: "outline" },
  SCHEDULED: { label: "Scheduled", variant: "warning" },
  COMPLETED: { label: "Completed", variant: "success" },
  CANCELLED: { label: "Cancelled", variant: "error" },
  LEAD_CONFIRMED: { label: "Lead Confirmed", variant: "success" },
  EOI: { label: "EOI", variant: "default" },
  LEAD_ONLY: { label: "Lead Only", variant: "gold" },
};

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || { label: status.replace(/_/g, " "), variant: "outline" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function JourneyStatusBadge({ status }: { status: string }) {
  return <StatusBadge status={status} />;
}
