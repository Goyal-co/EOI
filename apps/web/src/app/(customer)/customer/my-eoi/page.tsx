"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import {
  Card, CardContent, CardHeader, CardTitle, Timeline, StatusBadge,
  LoadingSkeleton, EmptyState, Button, formatDate, PageHeader,
} from "@goyal/ui";
import { useCustomerEOI } from "@/lib/hooks";
import { customerPath, useCustomerEoiId } from "@/components/customer/project-switcher";
import type { TimelineStep } from "@goyal/ui";
import type { EOIStatus } from "@goyal/types";

function buildTimelineSteps(status: EOIStatus, eoi: {
  submittedAt?: string | null;
  approvedAt?: string | null;
  adminRemarks?: string | null;
  rejectionReason?: string | null;
  confirmationNumber?: string | null;
}): TimelineStep[] {
  const getStepStatus = (stepIndex: number, currentIndex: number): TimelineStep["status"] => {
    if (stepIndex < currentIndex) return "completed";
    if (stepIndex === currentIndex) return "current";
    return "upcoming";
  };

  const statusIndex = (s: EOIStatus) => {
    const map: Record<string, number> = {
      PENDING_SUBMISSION: 0,
      DRAFT: 0,
      SUBMITTED: 1,
      UNDER_REVIEW: 2,
      CORRECTION_REQUESTED: 2,
      APPROVED: 3,
      REJECTED: 3,
      CLOSED: 4,
    };
    return map[s] ?? 0;
  };

  const current = statusIndex(status);

  const steps: TimelineStep[] = [
    {
      id: "form",
      title: "EOI Form",
      description: status === "DRAFT" || status === "PENDING_SUBMISSION"
        ? "Complete and submit your EOI form"
        : "Form completed",
      status: getStepStatus(0, current),
    },
    {
      id: "submitted",
      title: "Submitted",
      description: "EOI submitted for review",
      status: getStepStatus(1, current),
      date: eoi.submittedAt ? formatDate(eoi.submittedAt) : undefined,
    },
    {
      id: "review",
      title: status === "CORRECTION_REQUESTED" ? "Corrections Required" : "Under Admin Review",
      description: status === "CORRECTION_REQUESTED"
        ? "Please update your EOI and re-submit"
        : "Goyal Projects team is reviewing your application",
      status: getStepStatus(2, current),
      remarks: status === "CORRECTION_REQUESTED" ? eoi.adminRemarks || undefined : undefined,
    },
    {
      id: "decision",
      title: status === "REJECTED" ? "Rejected" : status === "APPROVED" ? "Approved" : "Decision",
      description: status === "APPROVED"
        ? `Confirmation: ${eoi.confirmationNumber}`
        : status === "REJECTED"
          ? eoi.rejectionReason || "Application not approved"
          : "Awaiting final decision",
      status: getStepStatus(3, current),
      date: eoi.approvedAt ? formatDate(eoi.approvedAt) : undefined,
      remarks: status === "REJECTED" ? eoi.rejectionReason || undefined : undefined,
    },
  ];

  if (status === "CLOSED") {
    steps.push({
      id: "closed",
      title: "Closed",
      description: "EOI process completed",
      status: "completed",
    });
  }

  return steps;
}

function MyEOIContent() {
  const router = useRouter();
  const eoiId = useCustomerEoiId();
  const { data: eoi, isLoading } = useCustomerEOI(eoiId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton rows={5} />
      </div>
    );
  }

  if (!eoi) {
    return (
      <div className="space-y-6">
        <EmptyState title="No EOI Found" description="You don't have an active Expression of Interest." />
      </div>
    );
  }

  const canEdit = ["PENDING_SUBMISSION", "DRAFT", "CORRECTION_REQUESTED"].includes(eoi.status);
  const steps = buildTimelineSteps(eoi.status as EOIStatus, eoi);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My EOI"
        description={eoi.project?.name}
        actions={<StatusBadge status={eoi.status} />}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Application Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <Timeline steps={steps} />
        </CardContent>
      </Card>

      {canEdit && (
        <div className="flex gap-3">
          <Button variant="gold" onClick={() => router.push(customerPath("/customer/eoi", eoiId))}>
            {eoi.status === "CORRECTION_REQUESTED" ? "Update EOI" : "Complete EOI Form"}
          </Button>
          <Button variant="outline" onClick={() => router.push(customerPath("/customer/documents", eoiId))}>
            Upload Documents
          </Button>
        </div>
      )}

      {(eoi.approvalActions?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activity History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(eoi.approvalActions ?? []).map((action: { id?: string; action: string; remarks?: string; createdAt: string }) => (
              <div key={action.id} className="flex items-start justify-between text-sm border-b border-border pb-3 last:border-0">
                <div>
                  <p className="font-medium text-foreground">{action.action.replace(/_/g, " ")}</p>
                  {action.remarks && <p className="text-muted-foreground mt-0.5">{action.remarks}</p>}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{formatDate(action.createdAt)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function MyEOIPage() {
  return (
    <Suspense fallback={<LoadingSkeleton rows={5} />}>
      <MyEOIContent />
    </Suspense>
  );
}
