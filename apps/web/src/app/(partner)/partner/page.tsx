"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  StatCard, ProjectCard, CardSkeleton, DataTable, JourneyStatusBadge, formatDate, PageHeader,
} from "@goyal/ui";
import {
  UserCheck, FileText, CheckCircle, XCircle, Clock, Send, FileEdit, UserPlus,
} from "lucide-react";
import { usePartnerAnalytics, usePartnerProjects } from "@/lib/hooks";
import { SubmitEOIModal } from "@/components/submit-eoi-modal";
import { PunchLeadModal } from "@/components/punch-lead-modal";

interface PartnerAnalytics {
  totalLeads: { value: number; growth: number };
  confirmationPending: { value: number; growth: number };
  confirmationSent: { value: number; growth: number };
  draft: { value: number; growth: number };
  submittedEOIs: { value: number; growth: number };
  approvedEOIs: { value: number; growth: number };
  rejectedEOIs: { value: number; growth: number };
  leadOnlyTotal?: { value: number; growth: number };
  leadOnlyPending?: { value: number; growth: number };
  leadOnlyConfirmed?: { value: number; growth: number };
  recentLeads?: Array<{
    id: string;
    customerName: string;
    journeyStatus: string;
    confirmationSentAt?: string | null;
  }>;
}

interface Project {
  id: string;
  name: string;
  location: string;
  startingPrice: number;
  eoiStatus: string;
  bannerUrl?: string;
  myLeads: number;
}

const KPI_CONFIG = [
  { key: "totalLeads" as const, title: "Total Leads", icon: UserCheck },
  { key: "leadOnlyTotal" as const, title: "Lead-Only Total", icon: UserPlus },
  { key: "leadOnlyPending" as const, title: "Lead-Only Pending", icon: Clock },
  { key: "leadOnlyConfirmed" as const, title: "Lead-Only Confirmed", icon: CheckCircle },
  { key: "confirmationPending" as const, title: "Confirmation Pending", icon: Clock },
  { key: "confirmationSent" as const, title: "Confirmation Sent", icon: Send },
  { key: "draft" as const, title: "Draft", icon: FileEdit },
  { key: "submittedEOIs" as const, title: "Submitted EOIs", icon: FileText },
  { key: "approvedEOIs" as const, title: "Approved EOIs", icon: CheckCircle },
  { key: "rejectedEOIs" as const, title: "Rejected EOIs", icon: XCircle },
];

export default function PartnerDashboardPage() {
  const router = useRouter();
  const { data: analytics, isLoading: analyticsLoading } = usePartnerAnalytics();
  const { data: projects, isLoading: projectsLoading } = usePartnerProjects();
  const [eoiModal, setEoiModal] = useState<{ open: boolean; projectId: string; projectName: string }>({
    open: false,
    projectId: "",
    projectName: "",
  });
  const [punchModal, setPunchModal] = useState<{ open: boolean; projectId: string; projectName: string }>({
    open: false,
    projectId: "",
    projectName: "",
  });

  const stats = analytics as PartnerAnalytics | undefined;
  const projectList = (projects as Project[] | undefined) || [];
  const recentLeads = stats?.recentLeads || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of your partner activity"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {analyticsLoading ? (
          Array.from({ length: 7 }).map((_, i) => <CardSkeleton key={i} />)
        ) : (
          KPI_CONFIG.map(({ key, title, icon }) => (
            <StatCard
              key={key}
              title={title}
              value={stats?.[key]?.value ?? 0}
              icon={icon}
              growth={stats?.[key]?.growth}
              onClick={() => router.push("/partner/leads")}
            />
          ))
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-section-title">Recent Leads</h2>
          <button
            onClick={() => router.push("/partner/leads")}
            className="text-sm text-blue-600 hover:underline"
          >
            View all
          </button>
        </div>
        <DataTable
          columns={[
            { key: "customerName", header: "Customer" },
            {
              key: "journeyStatus",
              header: "Journey Status",
              render: (row) => <JourneyStatusBadge status={row.journeyStatus} />,
            },
            {
              key: "confirmationSentAt",
              header: "Confirmation Sent",
              render: (row) => row.confirmationSentAt ? formatDate(row.confirmationSentAt) : "—",
            },
          ]}
          data={recentLeads}
          loading={analyticsLoading}
          emptyTitle="No leads yet"
          emptyDescription="Submit an EOI to register your first lead"
          onRowClick={(row) => router.push("/partner/leads")}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-section-title">Your Projects</h2>
          <button
            onClick={() => router.push("/partner/projects")}
            className="text-sm text-blue-600 hover:underline"
          >
            View all
          </button>
        </div>

        {projectsLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projectList.slice(0, 6).map((project) => (
              <ProjectCard
                key={project.id}
                name={project.name}
                location={project.location}
                imageUrl={project.bannerUrl}
                startingPrice={project.startingPrice}
                eoiStatus={project.eoiStatus}
                totalLeads={project.myLeads}
                onViewDetails={() => router.push(`/partner/projects/${project.id}`)}
                onSubmitEOI={project.eoiStatus === "OPEN" ? () => setEoiModal({ open: true, projectId: project.id, projectName: project.name }) : undefined}
                onPunchLead={project.eoiStatus !== "OPEN" ? () => setPunchModal({ open: true, projectId: project.id, projectName: project.name }) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      <SubmitEOIModal
        open={eoiModal.open}
        onOpenChange={(open) => setEoiModal((prev) => ({ ...prev, open }))}
        projectId={eoiModal.projectId}
        projectName={eoiModal.projectName}
      />
      <PunchLeadModal
        open={punchModal.open}
        onOpenChange={(open) => setPunchModal((prev) => ({ ...prev, open }))}
        projectId={punchModal.projectId}
        projectName={punchModal.projectName}
      />
    </div>
  );
}
