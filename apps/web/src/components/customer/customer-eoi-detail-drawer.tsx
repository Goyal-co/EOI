"use client";

import { useState } from "react";
import {
  Drawer, Card, CardContent, CardHeader, CardTitle, formatDate,
} from "@goyal/ui";

function FormSection({ title, data }: { title: string; data: Record<string, unknown> | undefined }) {
  if (!data || Object.keys(data).length === 0) return null;
  return (
    <div className="rounded-lg bg-blue-50 p-4 space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="flex justify-between gap-4 text-sm">
          <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
          <span className="font-medium text-foreground text-right">{String(value ?? "—")}</span>
        </div>
      ))}
    </div>
  );
}

interface CustomerEoiDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  eoi: {
    referenceNumber?: string | null;
    confirmationNumber?: string | null;
    status: string;
    submittedAt?: string | null;
    approvedAt?: string | null;
    formData?: Record<string, unknown>;
    lead?: { customerName: string; customerEmail: string; customerMobile: string };
    project?: { name: string };
    documents?: { type: string; fileName: string; status: string }[];
  } | null;
}

export function CustomerEoiDetailDrawer({ open, onClose, eoi }: CustomerEoiDetailDrawerProps) {
  if (!eoi) return null;

  const formData = (eoi.formData || {}) as Record<string, unknown>;
  const personal = formData.personal as Record<string, unknown> | undefined;
  const address = formData.address as Record<string, unknown> | undefined;
  const unit = formData.unit as Record<string, unknown> | undefined;
  const bank = formData.bank as Record<string, unknown> | undefined;

  return (
    <Drawer open={open} onClose={onClose} title="EOI Details">
      <div className="space-y-4">
        <div className="rounded-lg border border-border p-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">EOI Number</span>
            <span className="font-medium">{eoi.referenceNumber || eoi.confirmationNumber || "—"}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Project</span>
            <span className="font-medium">{eoi.project?.name || "—"}</span>
          </div>
          {eoi.submittedAt && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Submitted</span>
              <span className="font-medium">{formatDate(eoi.submittedAt)}</span>
            </div>
          )}
          {eoi.approvedAt && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Approved</span>
              <span className="font-medium">{formatDate(eoi.approvedAt)}</span>
            </div>
          )}
        </div>

        <FormSection title="Personal Details" data={personal} />
        <FormSection title="Address" data={address} />
        <FormSection title="Unit Preference" data={unit} />
        <FormSection title="Bank Details" data={bank} />

        {(eoi.documents?.length ?? 0) > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {eoi.documents!.map((doc) => (
                <div key={doc.type} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{doc.type.replace(/_/g, " ")}</span>
                  <span className="font-medium">{doc.fileName}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </Drawer>
  );
}
