"use client";

import { useRouter } from "next/navigation";
import {
  StatCard, ProjectCard, ChartCard, LoadingSkeleton, EmptyState, PageHeader,
} from "@goyal/ui";
import {
  Users, UserCheck, FileText, CheckCircle, XCircle, TrendingUp, Bell,
  Clock, FileEdit, Upload, AlertCircle, UserPlus,
} from "lucide-react";
import { useAdminOverview } from "@/lib/hooks";

interface OverviewData {
  stats: {
    totalCPs: { value: number; growth: number };
    pendingCPs: { value: number; growth: number };
    totalLeads: { value: number; growth: number };
    totalEOIs: { value: number; growth: number };
    approvedEOIs: { value: number; growth: number };
    rejectedEOIs: { value: number; growth: number };
    submittedEOIs: { value: number; growth: number };
    draftEOIs: { value: number; growth: number };
    confirmationPending: { value: number; growth: number };
    chequeUploaded: { value: number; growth: number };
    chequeMissing: { value: number; growth: number };
    closures: { value: number; growth: number };
    leadOnlyTotal: { value: number; growth: number };
    leadOnlyPending: { value: number; growth: number };
    leadOnlyConfirmed: { value: number; growth: number };
    eoiLeadsTotal: { value: number; growth: number };
  };
  pendingApprovals: number;
  projectPerformance: Array<{
    id: string;
    name: string;
    location: string;
    eoiStatus: string;
    bannerUrl?: string;
    totalLeads: number;
    totalEois: number;
    leadOnlyCount?: number;
    eoiLeadCount?: number;
    totalClosures: number;
    conversionRate: number;
  }>;
  charts: {
    eoiTrend: Array<{ name: string; value: number }>;
    leadDistribution: Array<{ name: string; value: number }>;
    approvalRatio: Array<{ name: string; value: number }>;
  };
}

const statConfig = [
  { key: "totalCPs" as const, title: "Channel Partners", icon: Users },
  { key: "pendingCPs" as const, title: "Pending CPs", icon: Clock },
  { key: "totalLeads" as const, title: "Total Leads", icon: UserCheck },
  { key: "leadOnlyTotal" as const, title: "Lead-Only Total", icon: UserPlus },
  { key: "leadOnlyPending" as const, title: "Lead-Only Pending", icon: Clock },
  { key: "leadOnlyConfirmed" as const, title: "Lead-Only Confirmed", icon: CheckCircle },
  { key: "confirmationPending" as const, title: "Confirmation Pending", icon: Clock },
  { key: "draftEOIs" as const, title: "Draft EOIs", icon: FileEdit },
  { key: "totalEOIs" as const, title: "Total EOIs", icon: FileText },
  { key: "chequeUploaded" as const, title: "Cheque Uploaded", icon: Upload },
  { key: "chequeMissing" as const, title: "Cheque Missing", icon: AlertCircle },
  { key: "approvedEOIs" as const, title: "Approved EOIs", icon: CheckCircle },
  { key: "rejectedEOIs" as const, title: "Rejected EOIs", icon: XCircle },
  { key: "closures" as const, title: "Closures", icon: TrendingUp },
];

function getStatRoute(key: string): string {
  if (key === "totalCPs" || key === "pendingCPs") return "/admin/channel-partners";
  if (key.startsWith("leadOnly") || key === "totalLeads" || key === "confirmationPending") return "/admin/leads";
  return "/admin/approvals";
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { data, isLoading, error } = useAdminOverview();
  const overview = data as OverviewData | undefined;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton rows={2} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <LoadingSkeleton key={i} rows={3} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div>
        <EmptyState title="Failed to load dashboard" description="Please refresh the page or try again later." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Overview"
        description="Real-time snapshot of your EOI platform"
        actions={
          overview.pendingApprovals > 0 ? (
            <button
              onClick={() => router.push("/admin/approvals")}
              className="flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors"
            >
              <Bell className="h-4 w-4" />
              {overview.pendingApprovals} Pending Approval{overview.pendingApprovals === 1 ? "" : "s"}
            </button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {statConfig.map(({ key, title, icon: Icon }) => (
          <StatCard
            key={key}
            title={title}
            value={overview.stats[key]?.value ?? 0}
            icon={Icon}
            growth={overview.stats[key]?.growth}
            onClick={() => router.push(getStatRoute(key))}
          />
        ))}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Project Performance</h2>
        {overview.projectPerformance.length === 0 ? (
          <EmptyState title="No active projects" description="Add a project to see performance metrics." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {overview.projectPerformance.map((project) => (
              <ProjectCard
                key={project.id}
                name={project.name}
                location={project.location}
                imageUrl={project.bannerUrl}
                eoiStatus={project.eoiStatus}
                totalLeads={project.totalLeads}
                totalEois={project.totalEois}
                leadOnlyCount={project.leadOnlyCount}
                eoiLeadCount={project.eoiLeadCount}
                totalClosures={project.totalClosures}
                conversionRate={project.conversionRate}
                onViewDetails={() => router.push("/admin/projects")}
              />
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="EOI Trend (7 Days)" type="line" data={overview.charts.eoiTrend} />
        <ChartCard title="Lead Distribution by Project" type="bar" data={overview.charts.leadDistribution} />
        <ChartCard title="Approval Ratio" type="pie" data={overview.charts.approvalRatio} />
      </div>
    </div>
  );
}
