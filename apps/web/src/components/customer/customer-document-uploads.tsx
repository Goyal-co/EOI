"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Card, CardContent, CardHeader, CardTitle, FileUpload, StatusBadge, useToast, formatDate,
} from "@goyal/ui";
import type { UploadedFile } from "@goyal/ui";
import type { DocumentType } from "@goyal/types";
import { uploadViaPresign } from "@/lib/uploads/client-upload";
import {
  CUSTOMER_EOI_DOCUMENT_TYPES,
  CUSTOMER_DOCUMENT_LABELS,
  type CustomerEoiDocumentType,
} from "@/lib/required-documents";

export interface CustomerDocumentRecord {
  id: string;
  type: DocumentType;
  fileName: string;
  fileUrl: string;
  fileSize?: number;
  status: string;
  uploadedAt: string;
}

interface CustomerDocumentUploadsProps {
  eoiId?: string | null;
  documents: CustomerDocumentRecord[];
  requiredTypes?: CustomerEoiDocumentType[];
  onPreview?: (doc: CustomerDocumentRecord) => void;
  compact?: boolean;
}

export function CustomerDocumentUploads({
  eoiId,
  documents,
  requiredTypes,
  onPreview,
  compact = false,
}: CustomerDocumentUploadsProps) {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [uploads, setUploads] = useState<Record<string, UploadedFile | null>>({});

  const docsQuery = eoiId ? `?eoiId=${encodeURIComponent(eoiId)}` : "";
  const typesToShow = requiredTypes?.length
    ? requiredTypes
    : [...CUSTOMER_EOI_DOCUMENT_TYPES];

  const getDocForType = (type: DocumentType) => documents.find((d) => d.type === type);

  const handleUpload = async (type: DocumentType, file: File) => {
    setUploads((prev) => ({
      ...prev,
      [type]: { name: file.name, size: file.size, status: "uploading", progress: 0 },
    }));

    try {
      const uploaded = await uploadViaPresign(file, type);

      const res = await fetch(`/api/customer/documents${docsQuery}`, {
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

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }

      setUploads((prev) => ({
        ...prev,
        [type]: { name: file.name, size: file.size, status: "success", url: uploaded.fileUrl },
      }));

      await qc.invalidateQueries({ queryKey: ["customer", "documents"] });
      await qc.invalidateQueries({ queryKey: ["customer", "eoi"] });
      addToast({ type: "success", title: "Document uploaded", message: CUSTOMER_DOCUMENT_LABELS[type as CustomerEoiDocumentType] || type });
    } catch (e) {
      setUploads((prev) => ({ ...prev, [type]: null }));
      addToast({
        type: "error",
        title: "Upload failed",
        message: e instanceof Error ? e.message : "Please try again.",
      });
    }
  };

  const gridClass = compact
    ? "grid grid-cols-1 gap-4"
    : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6";

  return (
    <div className={gridClass}>
      {typesToShow.map((type) => {
        const label = CUSTOMER_DOCUMENT_LABELS[type];
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
                onPreview={existing && onPreview ? () => onPreview(existing) : undefined}
                onSizeError={(file, max) =>
                  addToast({
                    type: "error",
                    title: "File too large",
                    message: `${file.name} exceeds ${Math.round(max / (1024 * 1024))}MB limit`,
                  })
                }
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
  );
}
