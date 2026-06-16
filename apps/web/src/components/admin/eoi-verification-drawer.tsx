"use client";

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Drawer, StatusBadge, Button, Modal, Textarea, useToast, LoadingSkeleton,
} from "@goyal/ui";
import { CheckCircle, XCircle, AlertTriangle, FileText, ExternalLink, Eye } from "lucide-react";
import type { PendingEOI } from "@/lib/types";

type ActionType = "APPROVE" | "REJECT" | "REQUEST_CORRECTION";

interface EoiVerificationDrawerProps {
  eoiId: string | null;
  onClose: () => void;
  initialData?: PendingEOI | null;
}

function FormSection({ title, data }: { title: string; data: Record<string, unknown> | undefined }) {
  if (!data || Object.keys(data).length === 0) return null;
  return (
    <div className="rounded-lg bg-blue-50 p-4 space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="flex justify-between text-sm gap-4">
          <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
          <span className="font-medium text-foreground text-right">{String(value ?? "—")}</span>
        </div>
      ))}
    </div>
  );
}

export function EoiVerificationDrawer({ eoiId, onClose, initialData }: EoiVerificationDrawerProps) {
  const [eoi, setEoi] = useState<PendingEOI | null>(initialData ?? null);
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [actionModal, setActionModal] = useState<ActionType | null>(null);
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [piiRevealed, setPiiRevealed] = useState(false);
  const [revealingPii, setRevealingPii] = useState(false);
  const qc = useQueryClient();
  const { addToast } = useToast();

  useEffect(() => {
    if (!eoiId) {
      setEoi(null);
      setPiiRevealed(false);
      return;
    }
    if (initialData?.id === eoiId) {
      setEoi(initialData);
      return;
    }
    setLoading(true);
    fetch(`/api/admin/eois/${eoiId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setEoi(data);
      })
      .catch((e) => addToast({ type: "error", title: "Failed to load EOI", message: e.message }))
      .finally(() => setLoading(false));
  }, [eoiId, initialData, addToast]);

  const openDocumentPreview = async (docId: string) => {
    try {
      const res = await fetch(`/api/admin/documents/${docId}/download`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPreviewUrl(data.downloadUrl);
    } catch (e) {
      addToast({ type: "error", title: "Preview failed", message: (e as Error).message });
    }
  };

  const revealPii = async () => {
    if (!eoi) return;
    setRevealingPii(true);
    try {
      const res = await fetch(`/api/admin/eois/${eoi.id}/reveal-pii`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reveal PII");
      setEoi((prev) => prev ? { ...prev, formData: data.formData, piiMasked: false } : prev);
      setPiiRevealed(true);
      addToast({ type: "success", title: "PII revealed", message: "Sensitive fields are now visible. This action has been logged." });
    } catch (e) {
      addToast({ type: "error", title: "Reveal failed", message: (e as Error).message });
    } finally {
      setRevealingPii(false);
    }
  };

  const handleAction = async () => {
    if (!eoi || !actionModal) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/eois/${eoi.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionModal, reason: reason || undefined, remarks: remarks || undefined }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Action failed");
      }
      await qc.invalidateQueries({ queryKey: ["admin", "pending-eois"] });
      await qc.invalidateQueries({ queryKey: ["admin", "all-eois"] });
      await qc.invalidateQueries({ queryKey: ["admin", "overview"] });
      const labels = { APPROVE: "approved", REJECT: "rejected", REQUEST_CORRECTION: "sent for correction" };
      addToast({ type: "success", title: `EOI ${labels[actionModal]}`, message: `${eoi.customerName}'s EOI has been ${labels[actionModal]}.` });
      setActionModal(null);
      onClose();
    } catch (e) {
      addToast({ type: "error", title: "Action failed", message: (e as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  const formData = (eoi?.formData || {}) as Record<string, Record<string, unknown>>;
  const bankDetails = formData.bankDetails as Record<string, unknown> | undefined;
  const isPending = eoi?.status === "SUBMITTED" || eoi?.status === "UNDER_REVIEW";

  return (
    <>
      <Drawer
        open={!!eoiId}
        onClose={onClose}
        title="EOI Verification"
        className="max-w-2xl"
        footer={
          isPending && eoi ? (
            <div className="flex w-full gap-2">
              <Button className="flex-1" onClick={() => { setActionModal("APPROVE"); setReason(""); setRemarks(""); }}>
                <CheckCircle className="h-4 w-4" /> Approve
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => { setActionModal("REQUEST_CORRECTION"); setReason(""); setRemarks(""); }}>
                <AlertTriangle className="h-4 w-4" /> Correction
              </Button>
              <Button variant="destructive" className="flex-1" onClick={() => { setActionModal("REJECT"); setReason(""); setRemarks(""); }}>
                <XCircle className="h-4 w-4" /> Reject
              </Button>
            </div>
          ) : undefined
        }
      >
        {loading && <LoadingSkeleton rows={6} />}
        {!loading && eoi && (
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <StatusBadge status={eoi.status} />
                {eoi.journeyStatus && <StatusBadge status={eoi.journeyStatus} />}
                {eoi.referenceNumber && (
                  <span className="text-sm font-mono text-muted-foreground">{eoi.referenceNumber}</span>
                )}
              </div>
              <h3 className="text-lg font-semibold text-foreground">{eoi.customerName}</h3>
              <p className="text-sm text-muted-foreground">{eoi.customerEmail} · {eoi.customerMobile}</p>
            </div>

            <div className="rounded-lg border border-border p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Project</span><span className="font-medium">{eoi.project}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Location</span><span className="font-medium">{eoi.projectLocation}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Channel Partner</span><span className="font-medium">{eoi.cpName}</span></div>
              {eoi.submittedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Submitted</span>
                  <span className="font-medium">{new Date(eoi.submittedAt).toLocaleString("en-IN")}</span>
                </div>
              )}
            </div>

            {(eoi as { piiMasked?: boolean }).piiMasked !== false && !piiRevealed && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-center justify-between gap-4">
                <p className="text-sm text-amber-800">Sensitive PII fields (PAN, Aadhaar) are masked by default.</p>
                <Button variant="outline" size="sm" loading={revealingPii} onClick={revealPii}>
                  <Eye className="h-4 w-4" /> Reveal PII
                </Button>
              </div>
            )}

            <FormSection title="Personal Details" data={formData.personal} />
            <FormSection title="Address" data={formData.address} />
            <FormSection title="Unit Preference" data={formData.unitPreference} />
            <FormSection title="Bank Details" data={bankDetails} />

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Cheque</h4>
              <div className="flex items-center gap-2 mb-3">
                <StatusBadge status={eoi.chequeDoc || eoi.chequeUploaded ? "APPROVED" : "PENDING"} />
                {(eoi.chequeNumber || bankDetails?.chequeNumber) ? (
                  <span className="text-sm text-foreground">#{String(eoi.chequeNumber || bankDetails?.chequeNumber)}</span>
                ) : null}
              </div>
              {eoi.chequeDoc && (
                <Button variant="outline" size="sm" onClick={() => openDocumentPreview(eoi.chequeDoc!.id)}>
                  <FileText className="h-4 w-4" /> Preview Cheque
                </Button>
              )}
            </div>

            {(eoi.documents?.length ?? 0) > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Documents</h4>
                <div className="space-y-2">
                  {eoi.documents!.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{doc.type}</p>
                        <p className="text-xs text-muted-foreground">{doc.fileName}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => openDocumentPreview(doc.id)}>
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </Drawer>

      <Modal
        open={!!actionModal}
        onOpenChange={() => setActionModal(null)}
        title={actionModal === "APPROVE" ? "Approve EOI" : actionModal === "REJECT" ? "Reject EOI" : "Request Correction"}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setActionModal(null)}>Cancel</Button>
            <Button
              variant={actionModal === "REJECT" ? "destructive" : "default"}
              loading={submitting}
              onClick={handleAction}
              disabled={actionModal !== "APPROVE" && !reason.trim()}
            >
              Confirm
            </Button>
          </>
        }
      >
        {actionModal !== "APPROVE" && (
          <Textarea
            label={actionModal === "REJECT" ? "Rejection Reason" : "Correction Details"}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="mb-4"
          />
        )}
        <Textarea label="Remarks (optional)" value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
      </Modal>

      <Modal open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)} title="Document Preview" size="lg">
        {previewUrl && (
          <div className="flex flex-col items-center gap-4">
            {previewUrl.match(/\.(jpg|jpeg|png|webp)(\?|$)/i) ? (
              <img src={previewUrl} alt="Document" className="max-h-[60vh] rounded-lg" />
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">PDF preview not available in browser.</p>
                <Button variant="outline" onClick={() => window.open(previewUrl, "_blank")}>Open in New Tab</Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
