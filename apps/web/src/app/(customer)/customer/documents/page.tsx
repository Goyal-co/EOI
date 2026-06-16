"use client";

import { Suspense, useState } from "react";
import {
  Card, CardContent, CardHeader, CardTitle, FileUpload, StatusBadge,
  LoadingSkeleton, EmptyState, Modal, Button, formatDate, PageHeader, useToast,
} from "@goyal/ui";
import type { UploadedFile } from "@goyal/ui";
import { useCustomerDocuments } from "@/lib/hooks";
import { useQueryClient } from "@tanstack/react-query";
import type { DocumentType } from "@goyal/types";
import { useCustomerEoiId } from "@/components/customer/project-switcher";
import { uploadViaPresign } from "@/lib/uploads/client-upload";
import { getPresignedUrlForPreview, isImageFileName, openPresignedAsset } from "@/lib/files/open-asset";

const DOC_TYPES: { type: DocumentType; label: string }[] = [
  { type: "PAN", label: "PAN Card" },
  { type: "AADHAAR", label: "Aadhaar Card" },
  { type: "CHEQUE", label: "EOI Cheque" },
];

interface DocumentRecord {
  id: string;
  type: DocumentType;
  fileName: string;
  fileUrl: string;
  fileSize?: number;
  status: string;
  uploadedAt: string;
}

function CustomerDocumentsContent() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const eoiId = useCustomerEoiId();
  const docsQuery = eoiId ? `?eoiId=${encodeURIComponent(eoiId)}` : "";
  const { data: documents, isLoading } = useCustomerDocuments(eoiId);
  const [uploads, setUploads] = useState<Record<string, UploadedFile | null>>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState<string>("");

  const docs = (documents as DocumentRecord[]) || [];

  const getDocForType = (type: DocumentType) =>
    docs.find((d) => d.type === type);

  const handlePreview = async (doc: DocumentRecord) => {
    try {
      const url = await getPresignedUrlForPreview(`/api/customer/documents/${doc.id}/download`);
      setPreviewFileName(doc.fileName);
      setPreviewUrl(url);
    } catch {
      addToast({ type: "error", title: "Preview failed", message: "Could not load document." });
    }
  };

  const handleUpload = async (type: DocumentType, file: File) => {
    setUploads((prev) => ({
      ...prev,
      [type]: { name: file.name, size: file.size, status: "uploading", progress: 0 },
    }));

    try {
      const uploaded = await uploadViaPresign(file, type);

      await fetch(`/api/customer/documents${docsQuery}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          fileName: uploaded.fileName,
          fileUrl: uploaded.fileUrl,
          fileSize: uploaded.fileSize,
          mimeType: uploaded.mimeType,
        }),
      });

      setUploads((prev) => ({
        ...prev,
        [type]: { name: file.name, size: file.size, status: "success", url: uploaded.fileUrl },
      }));

      qc.invalidateQueries({ queryKey: ["customer", "documents"] });
    } catch {
      setUploads((prev) => ({ ...prev, [type]: null }));
      addToast({
        type: "error",
        title: "Upload failed",
        message: "Please try again.",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton rows={3} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="Upload and manage your EOI supporting documents."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {DOC_TYPES.map(({ type, label }) => {
          const existing = getDocForType(type);
          const upload = uploads[type];

          return (
            <Card key={type}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{label}</CardTitle>
                  {existing && <StatusBadge status={existing.status} />}
                </div>
              </CardHeader>
              <CardContent>
                <FileUpload
                  label={label}
                  file={
                    upload ||
                    (existing
                      ? {
                          name: existing.fileName,
                          size: existing.fileSize || 0,
                          status: "success" as const,
                          url: existing.fileUrl,
                        }
                      : null)
                  }
                  onUpload={(f) => handleUpload(type, f)}
                  onRemove={() => setUploads((prev) => ({ ...prev, [type]: null }))}
                  onPreview={existing ? () => handlePreview(existing) : undefined}
                />
                {existing && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Uploaded {formatDate(existing.uploadedAt)}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {docs.length === 0 && !Object.values(uploads).some(Boolean) && (
        <EmptyState
          title="No Documents Yet"
          description="Upload your PAN, Aadhaar, and EOI cheque to complete your application."
        />
      )}

      <Modal open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)} title="Document Preview" size="lg">
        {previewUrl && (
          <div className="flex flex-col items-center gap-4">
            {isImageFileName(previewFileName || previewUrl) ? (
              <img src={previewUrl} alt="Document" className="max-h-[60vh] rounded-lg" />
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">PDF preview not available in browser.</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    const doc = docs.find((d) => d.fileName === previewFileName);
                    if (doc) openPresignedAsset(`/api/customer/documents/${doc.id}/download`);
                  }}
                >
                  Open in New Tab
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default function CustomerDocumentsPage() {
  return (
    <Suspense fallback={<LoadingSkeleton rows={3} />}>
      <CustomerDocumentsContent />
    </Suspense>
  );
}
