"use client";

import { useState } from "react";
import { DataTable, StatusBadge, Select, PageHeader } from "@goyal/ui";
import { useAdminLeads, useAdminProjects, useAdminCPs } from "@/lib/hooks";
import type { Lead as AdminLead } from "@/lib/types";

interface Project { id: string; name: string }
interface CP { id: string; name: string }

const JOURNEY_STATUSES = [
  { value: "", label: "All Statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "CONFIRMATION_PENDING", label: "Confirmation Pending" },
  { value: "DRAFT", label: "Draft" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CORRECTION_PENDING", label: "Correction Pending" },
  { value: "LEAD_CONFIRMED", label: "Lead Confirmed" },
];

const INTENT_TYPES = [
  { value: "", label: "All Types" },
  { value: "EOI", label: "EOI" },
  { value: "LEAD_ONLY", label: "Lead Only" },
];

export default function AdminLeadsPage() {
  const [filters, setFilters] = useState<Record<string, string>>({
    projectId: "",
    status: "",
    cpId: "",
    intentType: "",
  });

  const activeFilters = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== "")
  );

  const { data, isLoading } = useAdminLeads(
    Object.keys(activeFilters).length > 0 ? activeFilters : undefined
  );
  const { data: projectsData } = useAdminProjects();
  const { data: cpsData } = useAdminCPs();

  const leads = (data as AdminLead[]) || [];
  const projects = (projectsData as Project[]) || [];
  const cps = (cpsData as CP[]) || [];

  const filterBar = (
    <div className="flex flex-wrap gap-4">
      <Select
        label="Project"
        value={filters.projectId}
        onChange={(e) => setFilters({ ...filters, projectId: e.target.value })}
        options={[
          { value: "", label: "All Projects" },
          ...projects.map((p) => ({ value: p.id, label: p.name })),
        ]}
        className="min-w-[180px]"
      />
      <Select
        label="Journey Status"
        value={filters.status}
        onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        options={JOURNEY_STATUSES}
        className="min-w-[180px]"
      />
      <Select
        label="Channel Partner"
        value={filters.cpId}
        onChange={(e) => setFilters({ ...filters, cpId: e.target.value })}
        options={[
          { value: "", label: "All Partners" },
          ...cps.map((cp) => ({ value: cp.id, label: cp.name })),
        ]}
        className="min-w-[180px]"
      />
      <Select
        label="Intent Type"
        value={filters.intentType}
        onChange={(e) => setFilters({ ...filters, intentType: e.target.value })}
        options={INTENT_TYPES}
        className="min-w-[180px]"
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description="Track and filter leads across projects and channel partners"
      />

      <DataTable
        columns={[
          { key: "customerName", header: "Customer" },
          { key: "mobile", header: "Mobile" },
          { key: "project", header: "Project" },
          { key: "cpName", header: "Channel Partner" },
          {
            key: "intentType",
            header: "Type",
            render: (row) => (
              <StatusBadge status={(row as AdminLead & { intentType?: string }).intentType === "LEAD_ONLY" ? "LEAD_ONLY" : "EOI"} />
            ),
          },
          {
            key: "journeyStatus",
            header: "Journey Status",
            render: (row) => <StatusBadge status={(row.journeyStatus || row.leadStatus) as string} />,
          },
          {
            key: "eoiStatus",
            header: "EOI Status",
            render: (row) => (
              (row as AdminLead & { intentType?: string }).intentType === "LEAD_ONLY"
                ? <span className="text-muted-foreground">N/A</span>
                : <StatusBadge status={row.eoiStatus === "N/A" ? "PENDING" : (row.eoiStatus as string)} />
            ),
          },
          {
            key: "siteVisitStatus",
            header: "Site Visit",
            render: (row) => <StatusBadge status={(row.siteVisitStatus || "NOT_SCHEDULED") as string} />,
          },
          {
            key: "dateAdded",
            header: "Date Added",
            render: (row) => new Date(row.dateAdded as string).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
          },
        ]}
        data={leads}
        loading={isLoading}
        filters={filterBar}
        emptyTitle="No leads found"
        emptyDescription="Try adjusting your filters or wait for channel partners to register leads."
      />
    </div>
  );
}
