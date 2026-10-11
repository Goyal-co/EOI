"use client";

import { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  DataTable,
  StatusBadge,
  Card,
  CardSkeleton,
  EmptyState,
  formatDate,
  cn,
  PageHeader,
  Input,
  LoadingSkeleton,
  Button,
  Modal,
  FileUpload,
  useToast,
} from "@goyal/ui";
import { LayoutGrid, List } from "lucide-react";
import { usePartnerEOIs } from "@/lib/hooks";
import { uploadViaPresign } from "@/lib/uploads/client-upload";

interface EOI {
  id: string;
  status: string;
  filledBy?: string;
  createdAt: string;
  submittedAt?: string;
  confirmationNumber?: string;
  referenceNumber?: string;
  adminRemarks?: string | null;
  rejectionReason?: string | null;
  lead: { customerName: string; customerEmail: string };
  project: { name: string };
  documents?: Array<{ id: string; type: string; fileName: string; fileUrl: string }>;
}

type UploadedDoc = {
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
};

function PartnerEOIsContent() {
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status") || undefined;
  const { data, isLoading } = usePartnerEOIs(statusFilter);
  const allEois = (data as EOI[] | undefined) || [];
  const [view, setView] = useState<"cards" | "table">("cards");
  const [searchQuery, setSearchQuery] = useState("");
  const [selected, setSelected] = useState<EOI | null>(null);
  const [eoiDocument, setEoiDocument] = useState<UploadedDoc | null>(null);
  const [chequeDocument, setChequeDocument] = useState<UploadedDoc | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState<"EOI_DOCUMENT" | "CHEQUE" | null>(null);
  const [saving, setSaving] = useState(false);
  const { addToast } = useToast();
  const qc = useQueryClient();

  const eois = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allEois;
    return allEois.filter((eoi) =>
      eoi.lead.customerName.toLowerCase().includes(q) ||
      eoi.lead.customerEmail.toLowerCase().includes(q) ||
      eoi.project.name.toLowerCase().includes(q) ||
      eoi.confirmationNumber?.toLowerCase().includes(q) ||
      eoi.referenceNumber?.toLowerCase().includes(q)
    );
  }, [allEois, searchQuery]);

  const openCorrection = (eoi: EOI) => {
    if (eoi.filledBy !== "CP" || eoi.status !== "CORRECTION_REQUESTED") return;
    setSelected(eoi);
    const existingEoi = eoi.documents?.find((d) => d.type === "EOI_DOCUMENT");
    const existingCheque = eoi.documents?.find((d) => d.type === "CHEQUE");
    setEoiDocument(
      existingEoi
        ? { fileUrl: existingEoi.fileUrl, fileName: existingEoi.fileName, fileSize: 0, mimeType: "" }
        : null,
    );
    setChequeDocument(
      existingCheque
        ? { fileUrl: existingCheque.fileUrl, fileName: existingCheque.fileName, fileSize: 0, mimeType: "" }
        : null,
    );
  };

  const uploadDoc = async (kind: "EOI_DOCUMENT" | "CHEQUE", file: File) => {
    if (!selected) return;
    setUploadingDoc(kind);
    try {
      const uploaded = await uploadViaPresign(file, kind === "CHEQUE" ? "CHEQUE" : "EOI_DOCUMENT");
      const res = await fetch(`/api/partner/eois/${selected.id}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: kind,
          fileName: uploaded.fileName,
          fileUrl: uploaded.fileUrl,
          fileSize: uploaded.fileSize,
          mimeType: uploaded.mimeType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      const doc: UploadedDoc = {
        fileUrl: uploaded.fileUrl,
        fileName: uploaded.fileName,
        fileSize: uploaded.fileSize,
        mimeType: uploaded.mimeType,
      };
      if (kind === "EOI_DOCUMENT") setEoiDocument(doc);
      else setChequeDocument(doc);
      addToast({ type: "success", title: "Document saved" });
      void qc.invalidateQueries({ queryKey: ["partner", "eois"] });
    } catch (e) {
      addToast({
        type: "error",
        title: "Upload failed",
        message: e instanceof Error ? e.message : "Try again",
      });
    } finally {
      setUploadingDoc(null);
    }
  };

  const resubmit = async () => {
    if (!selected) return;
    if (!eoiDocument || !chequeDocument) {
      addToast({ type: "error", title: "Both documents are required" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/partner/eois/${selected.id}/resubmit`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Resubmit failed");
      addToast({ type: "success", title: "EOI resubmitted", message: "Sent back for admin review." });
      setSelected(null);
      void qc.invalidateQueries({ queryKey: ["partner", "eois"] });
    } catch (e) {
      addToast({
        type: "error",
        title: "Resubmit failed",
        message: e instanceof Error ? e.message : "Try again",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="My EOIs"
        description="Track expression of interest submissions"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search EOIs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 sm:w-56"
            />
            <div className="flex gap-1 rounded-lg border border-border p-1">
              <button
                onClick={() => setView("cards")}
                className={cn("p-2 rounded-md transition-colors", view === "cards" ? "bg-blue-50 text-foreground" : "text-muted-foreground")}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setView("table")}
                className={cn("p-2 rounded-md transition-colors", view === "table" ? "bg-blue-50 text-foreground" : "text-muted-foreground")}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : eois.length === 0 ? (
        <EmptyState
          title={searchQuery ? "No matching EOIs" : "No EOIs yet"}
          description={searchQuery ? "Try a different search term" : "Submit an EOI from a project page to get started"}
        />
      ) : view === "cards" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {eois.map((eoi) => (
            <Card
              key={eoi.id}
              className={cn(
                "p-5",
                eoi.filledBy === "CP" && eoi.status === "CORRECTION_REQUESTED" && "cursor-pointer ring-1 ring-amber-300",
              )}
              onClick={() => openCorrection(eoi)}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-section-title">{eoi.lead.customerName}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{eoi.project.name}</p>
                </div>
                <StatusBadge status={eoi.status} />
              </div>
              <div className="space-y-1.5 text-sm text-muted-foreground">
                <p>{eoi.lead.customerEmail}</p>
                <p>Created {formatDate(eoi.createdAt)}</p>
                {eoi.filledBy === "CP" && (
                  <p className="text-xs font-medium text-amber-800">CP-submitted</p>
                )}
                {eoi.status === "CORRECTION_REQUESTED" && eoi.filledBy === "CP" && (
                  <p className="text-xs font-medium text-amber-900">Tap to fix documents &amp; resubmit</p>
                )}
                {eoi.confirmationNumber && (
                  <p className="text-gold font-medium">#{eoi.confirmationNumber}</p>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <DataTable<EOI>
          columns={[
            { key: "customer", header: "Customer", render: (row) => (
              <div>
                <p className="font-medium">{row.lead.customerName}</p>
                <p className="text-xs text-muted-foreground">{row.lead.customerEmail}</p>
              </div>
            )},
            { key: "project", header: "Project", render: (row) => row.project.name },
            { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
            { key: "createdAt", header: "Created", render: (row) => formatDate(row.createdAt) },
            { key: "confirmationNumber", header: "Confirmation #", render: (row) => row.confirmationNumber || "—" },
            {
              key: "actions",
              header: "",
              render: (row) =>
                row.filledBy === "CP" && row.status === "CORRECTION_REQUESTED" ? (
                  <Button variant="outline" size="sm" onClick={() => openCorrection(row)}>
                    Fix &amp; resubmit
                  </Button>
                ) : null,
            },
          ]}
          data={eois}
          loading={isLoading}
          emptyTitle="No EOIs found"
        />
      )}

      <Modal
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title="Correct EOI documents"
        description={
          selected
            ? `${selected.lead.customerName} · ${selected.project.name}`
            : undefined
        }
      >
        {selected && (
          <div className="space-y-4">
            {(selected.adminRemarks || selected.rejectionReason) && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                <p className="font-semibold">Admin feedback</p>
                <p className="mt-1">{selected.adminRemarks || selected.rejectionReason}</p>
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium">EOI Document *</label>
              <FileUpload
                accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
                maxSize={10 * 1024 * 1024}
                disabled={uploadingDoc === "EOI_DOCUMENT"}
                file={
                  eoiDocument
                    ? {
                        name: eoiDocument.fileName,
                        size: eoiDocument.fileSize,
                        url: eoiDocument.fileUrl,
                        status: uploadingDoc === "EOI_DOCUMENT" ? "uploading" : "success",
                      }
                    : null
                }
                onUpload={(file) => void uploadDoc("EOI_DOCUMENT", file)}
                onRemove={() => setEoiDocument(null)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Cancelled cheque *</label>
              <FileUpload
                accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
                maxSize={10 * 1024 * 1024}
                disabled={uploadingDoc === "CHEQUE"}
                file={
                  chequeDocument
                    ? {
                        name: chequeDocument.fileName,
                        size: chequeDocument.fileSize,
                        url: chequeDocument.fileUrl,
                        status: uploadingDoc === "CHEQUE" ? "uploading" : "success",
                      }
                    : null
                }
                onUpload={(file) => void uploadDoc("CHEQUE", file)}
                onRemove={() => setChequeDocument(null)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setSelected(null)}>
                Cancel
              </Button>
              <Button
                variant="gold"
                loading={saving}
                disabled={!eoiDocument || !chequeDocument}
                onClick={() => void resubmit()}
              >
                Resubmit for review
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default function PartnerEOIsPage() {
  return (
    <Suspense fallback={<LoadingSkeleton rows={6} />}>
      <PartnerEOIsContent />
    </Suspense>
  );
}
