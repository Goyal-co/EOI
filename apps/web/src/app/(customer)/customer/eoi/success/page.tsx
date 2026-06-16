"use client";

import { useRouter } from "next/navigation";
import { Button, Card, CardContent, PageHeader } from "@goyal/ui";
import { CheckCircle2, FileText, Upload } from "lucide-react";

export default function EOISuccessPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <PageHeader
        title="EOI Submitted Successfully"
        description="Your Expression of Interest has been submitted and is pending admin review."
      />

      <div className="flex items-center justify-center min-h-[50vh]">
        <Card className="w-full max-w-md text-center">
          <CardContent className="p-10">
            <div className="flex justify-center mb-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              </div>
            </div>
            <p className="text-muted-foreground mb-8">
              You will receive a notification once your EOI is processed.
            </p>
            <div className="flex flex-col gap-3">
              <Button variant="gold" onClick={() => router.push("/customer/documents")}>
                <Upload className="h-4 w-4" />
                Upload Documents
              </Button>
              <Button variant="outline" onClick={() => router.push("/customer/my-eoi")}>
                <FileText className="h-4 w-4" />
                Track My EOI
              </Button>
              <Button variant="ghost" onClick={() => router.push("/customer")}>
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
