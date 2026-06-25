"use client";

import { Suspense, useState } from "react";
import {
  LoadingSkeleton, EmptyState, Modal, Button, PageHeader, useToast,
} from "@goyal/ui";
import { useCustomerDocuments, useCustomerEOI } from "@/lib/hooks";
import { useCustomerEoiId } from "@/components/customer/project-switcher";
import {
  CustomerDocumentUploads,
  type CustomerDocumentRecord,
} from "@/components/customer/customer-document-uploads";
import { getPresignedUrlForPreview, isImageFileName, openPresignedAsset } from "@/lib/files/open-asset";

function CustomerDocumentsContent() {
  const { addToast } = useToast();
  const eoiId = useCustomerEoiId();
  const { data: documents, isLoading: docsLoading } = useCustomerDocuments(eoiId);
  const { data: eoi, isLoading: eoiLoading } = useCustomerEOI(eoiId);
  const isLoading = docsLoading || eoiLoading;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState<string>("");

  const docs = (documents as CustomerDocumentRecord[]) || [];

  const handlePreview = async (doc: CustomerDocumentRecord) => {
    try {
      const url = await getPresignedUrlForPreview(`/api/customer/documents/${doc.id}/download`);
      setPreviewFileName(doc.fileName);
      setPreviewUrl(url);
    } catch {
      addToast({ type: "error", title: "Preview failed", message: "Could not load document." });
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
        description="Upload and manage your EOI supporting documents. Re-upload here if your EOI was sent back for corrections."
      />

      <CustomerDocumentUploads
        eoiId={eoiId}
        eoiStatus={eoi?.status}
        documents={docs}
        onPreview={handlePreview}
      />

      {docs.length === 0 && (
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
