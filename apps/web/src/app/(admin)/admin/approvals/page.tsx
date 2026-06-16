"use client";

import { useState } from "react";
import {
  Card, StatusBadge, Button, EmptyState, LoadingSkeleton, PageHeader,
} from "@goyal/ui";
import { FileText, MapPin, User, Eye } from "lucide-react";
import { usePendingEOIs } from "@/lib/hooks";
import type { PendingEOI } from "@/lib/types";
import { EoiVerificationDrawer } from "@/components/admin/eoi-verification-drawer";

export default function AdminApprovalsPage() {
  const { data, isLoading } = usePendingEOIs();
  const eois = data || [];
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reviewData, setReviewData] = useState<PendingEOI | null>(null);

  const openReview = (eoi: PendingEOI) => {
    setReviewId(eoi.id);
    setReviewData(eoi);
  };

  if (isLoading) {
    return <div className="space-y-6"><LoadingSkeleton rows={4} /></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="EOI Approvals"
        description="Review and action pending Expression of Interest submissions"
        breadcrumb={[
          { label: "Dashboard", href: "/admin" },
          { label: "Approvals" },
        ]}
      />

      {eois.length === 0 ? (
        <EmptyState
          title="No pending approvals"
          description="All EOIs have been reviewed. New submissions will appear here."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {eois.map((eoi) => (
            <Card key={eoi.id} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-foreground">{eoi.customerName}</h3>
                  <p className="text-sm text-muted-foreground">{eoi.customerEmail}</p>
                </div>
                <StatusBadge status={eoi.status} />
              </div>

              <div className="space-y-2 text-sm mb-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {eoi.project} — {eoi.projectLocation}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-3.5 w-3.5" />
                  CP: {eoi.cpName}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" />
                  {(eoi.documents?.length ?? 0)} document{(eoi.documents?.length ?? 0) !== 1 ? "s" : ""} attached
                  {eoi.chequeDoc && " · Cheque uploaded"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Submitted {eoi.submittedAt ? new Date(eoi.submittedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                </p>
              </div>

              <Button size="sm" className="w-full" onClick={() => openReview(eoi)}>
                <Eye className="h-4 w-4" /> Review & Action
              </Button>
            </Card>
          ))}
        </div>
      )}

      <EoiVerificationDrawer
        eoiId={reviewId}
        initialData={reviewData}
        onClose={() => { setReviewId(null); setReviewData(null); }}
      />
    </div>
  );
}
