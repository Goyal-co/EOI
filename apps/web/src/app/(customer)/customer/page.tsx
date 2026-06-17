"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import {
  Button, Card, CardContent, CardHeader, CardTitle, StatusBadge, JourneyStatusBadge,
  ProjectCard, CardSkeleton, EmptyState, formatCurrency, formatDate, Badge, PageHeader,
} from "@goyal/ui";
import { useCustomerDashboard } from "@/lib/hooks";
import { customerPath, useCustomerEoiId } from "@/components/customer/project-switcher";
import { FileText, Upload, Building2, User, FolderOpen } from "lucide-react";

function CustomerDashboardContent() {
  const router = useRouter();
  const eoiId = useCustomerEoiId();
  const { data, isLoading } = useCustomerDashboard(eoiId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  if (!data?.hasEOI) {
    return (
      <div className="space-y-6">
        <EmptyState
          title="No Active EOI"
          description="You don't have an active Expression of Interest yet. Please use the invitation link sent by your Channel Partner."
          icon={<FileText className="h-8 w-8 text-muted-foreground" />}
        />
      </div>
    );
  }

  const { eoi, project, cpName, customerName, journeyStatus, eois = [], activeEoiId } = data;
  if (!eoi || !project) {
    return (
      <div className="space-y-6">
        <EmptyState title="No Active EOI" description="Your EOI data is not available yet." />
      </div>
    );
  }

  const displayJourneyStatus = journeyStatus || eoi.journeyStatus;
  const canSubmitEOI = ["PENDING_SUBMISSION", "DRAFT", "CORRECTION_REQUESTED"].includes(eoi.status);
  const currentEoiId = activeEoiId || eoiId;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${customerName?.split(" ")[0]}`}
        description="Track your Expression of Interest status and next steps."
      />

      {eois.length > 1 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {eois.map((entry) => (
            <Card
              key={entry.eoiId || entry.project?.id}
              className={entry.eoiId === currentEoiId ? "ring-2 ring-gold/50" : "hover:shadow-md transition-shadow cursor-pointer"}
              onClick={() => entry.eoiId && router.push(customerPath("/customer", entry.eoiId))}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-foreground">{entry.project?.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{entry.cpName}</p>
                  </div>
                  {entry.eoi?.status && <StatusBadge status={entry.eoi.status} />}
                </div>
                {entry.eoiId === currentEoiId && (
                  <Badge variant="default" className="mt-2">Active</Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 border-l-4 border-l-gold">
          <CardHeader>
            <CardTitle className="text-base">EOI Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <StatusBadge status={eoi.status} />
              {displayJourneyStatus && <JourneyStatusBadge status={displayJourneyStatus} />}
            </div>
            {eoi.referenceNumber && (
              <p className="text-sm text-muted-foreground">
                Reference: <span className="font-medium text-foreground">{eoi.referenceNumber}</span>
              </p>
            )}
            {eoi.confirmationNumber && (
              <p className="text-sm text-muted-foreground mt-1">
                Confirmation: <span className="font-medium text-foreground">{eoi.confirmationNumber}</span>
              </p>
            )}
            <div className="mt-3">
              <p className="text-sm text-muted-foreground mb-1">Cheque Status</p>
              <Badge variant={eoi.chequeUploaded ? "success" : "warning"}>
                {eoi.chequeUploaded ? "Cheque Uploaded" : "Cheque Pending"}
              </Badge>
            </div>
            {eoi.submittedAt && (
              <p className="text-sm text-muted-foreground mt-3">
                Submitted: {formatDate(eoi.submittedAt)}
              </p>
            )}
            {eoi.approvedAt && (
              <p className="text-sm text-muted-foreground mt-1">
                Approved: {formatDate(eoi.approvedAt)}
              </p>
            )}
            {eoi.rejectionReason && (
              <div className="mt-3 rounded-lg bg-red-50 border border-red-100 p-3 text-sm text-red-700">
                {eoi.rejectionReason}
              </div>
            )}
            {eoi.adminRemarks && eoi.status === "CORRECTION_REQUESTED" && (
              <div className="mt-3 rounded-lg bg-amber-50 border border-amber-100 p-3 text-sm text-amber-800">
                {eoi.adminRemarks}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <ProjectCard
            name={project.name}
            location={project.location}
            imageUrl={project.bannerUrl}
            startingPrice={project.startingPrice}
            eoiStatus={project.eoiStatus}
            onViewDetails={() => router.push(customerPath("/customer/project", currentEoiId))}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {canSubmitEOI && (
              <Button variant="gold" onClick={() => router.push(customerPath("/customer/eoi", currentEoiId))}>
                <FileText className="h-4 w-4" />
                {eoi.status === "CORRECTION_REQUESTED" ? "Update EOI" : "Complete EOI"}
              </Button>
            )}
            <Button variant="outline" onClick={() => router.push(customerPath("/customer/documents", currentEoiId))}>
              <Upload className="h-4 w-4" />
              Upload Documents
            </Button>
            <Button variant="outline" onClick={() => router.push(customerPath("/customer/project", currentEoiId, { tab: "brochure" }))}>
              <FolderOpen className="h-4 w-4" />
              Project Materials
            </Button>
            <Button variant="outline" onClick={() => router.push(customerPath("/customer/my-eoi", currentEoiId))}>
              <Building2 className="h-4 w-4" />
              Track Progress
            </Button>
            <Button variant="outline" onClick={() => router.push("/customer/profile")}>
              <User className="h-4 w-4" />
              My Profile
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-r from-blue-50/80 to-transparent">
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Your Channel Partner</p>
            <p className="font-medium text-foreground">{cpName}</p>
          </div>
          <p className="text-sm text-muted-foreground">
            From {formatCurrency(project.startingPrice)} / sqft
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function CustomerDashboardPage() {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <CustomerDashboardContent />
    </Suspense>
  );
}
