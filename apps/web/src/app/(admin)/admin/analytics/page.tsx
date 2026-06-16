"use client";

import { ChartCard, StatCard, LoadingSkeleton, EmptyState, PageHeader } from "@goyal/ui";
import { Users, UserCheck, FileText, TrendingUp } from "lucide-react";
import { useAdminOverview, useAdminProjects, useAdminCPs } from "@/lib/hooks";

interface OverviewData {
  stats: {
    totalCPs: { value: number; growth: number };
    totalLeads: { value: number; growth: number };
    totalEOIs: { value: number; growth: number };
    approvedEOIs: { value: number; growth: number };
    rejectedEOIs: { value: number; growth: number };
    closures: { value: number; growth: number };
  };
  pendingApprovals: number;
  charts: {
    eoiTrend: Array<{ name: string; value: number }>;
    leadDistribution: Array<{ name: string; value: number }>;
    approvalRatio: Array<{ name: string; value: number }>;
  };
}

interface Project {
  id: string;
  name: string;
  eoiCount: number;
  closures: number;
  activeCPs: number;
}

interface CP {
  id: string;
  name: string;
  registeredLeads: number;
  submittedEOIs: number;
  approvedEOIs: number;
}

export default function AdminAnalyticsPage() {
  const { data: overviewData, isLoading: overviewLoading } = useAdminOverview();
  const { data: projectsData } = useAdminProjects();
  const { data: cpsData } = useAdminCPs();

  const overview = overviewData as OverviewData | undefined;
  const projects = (projectsData as Project[]) || [];
  const cps = (cpsData as CP[]) || [];

  if (overviewLoading) {
    return <div className="space-y-6"><LoadingSkeleton rows={6} /></div>;
  }

  if (!overview) {
    return (
      <div>
        <EmptyState title="Analytics unavailable" description="Could not load analytics data." />
      </div>
    );
  }

  const eoiByProject = projects.map((p) => ({
    name: p.name.length > 15 ? `${p.name.slice(0, 15)}…` : p.name,
    value: p.eoiCount,
  }));

  const closuresByProject = projects.map((p) => ({
    name: p.name.length > 15 ? `${p.name.slice(0, 15)}…` : p.name,
    value: p.closures,
  }));

  const cpPerformance = cps
    .sort((a, b) => b.approvedEOIs - a.approvedEOIs)
    .slice(0, 8)
    .map((cp) => ({
      name: cp.name.length > 12 ? `${cp.name.slice(0, 12)}…` : cp.name,
      value: cp.approvedEOIs,
    }));

  const cpLeadVolume = cps
    .sort((a, b) => b.registeredLeads - a.registeredLeads)
    .slice(0, 8)
    .map((cp) => ({
      name: cp.name.length > 12 ? `${cp.name.slice(0, 12)}…` : cp.name,
      value: cp.registeredLeads,
    }));

  const conversionFunnel = [
    { name: "Leads", value: overview.stats.totalLeads.value },
    { name: "EOIs", value: overview.stats.totalEOIs.value },
    { name: "Approved", value: overview.stats.approvedEOIs.value },
    { name: "Closures", value: overview.stats.closures.value },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Advanced insights across projects, partners, and EOIs"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Channel Partners" value={overview.stats.totalCPs.value} icon={Users} growth={overview.stats.totalCPs.growth} />
        <StatCard title="Total Leads" value={overview.stats.totalLeads.value} icon={UserCheck} growth={overview.stats.totalLeads.growth} />
        <StatCard title="Total EOIs" value={overview.stats.totalEOIs.value} icon={FileText} growth={overview.stats.totalEOIs.growth} />
        <StatCard title="Closures" value={overview.stats.closures.value} icon={TrendingUp} growth={overview.stats.closures.growth} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="EOI Submission Trend" type="line" data={overview.charts.eoiTrend} height={280} />
        <ChartCard title="Conversion Funnel" type="bar" data={conversionFunnel} height={280} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Lead Distribution by Project" type="bar" data={overview.charts.leadDistribution} height={280} />
        <ChartCard title="Approval Ratio" type="pie" data={overview.charts.approvalRatio} height={280} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="EOIs by Project" type="bar" data={eoiByProject} height={280} />
        <ChartCard title="Closures by Project" type="bar" data={closuresByProject} height={280} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Top CPs by Approved EOIs" type="bar" data={cpPerformance} height={280} />
        <ChartCard title="Top CPs by Lead Volume" type="bar" data={cpLeadVolume} height={280} />
      </div>
    </div>
  );
}
