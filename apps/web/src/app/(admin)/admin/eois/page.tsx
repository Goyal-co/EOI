"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DataTable, StatusBadge, Select, Button, LoadingSkeleton, PageHeader } from "@goyal/ui";
import { EoiVerificationDrawer } from "@/components/admin/eoi-verification-drawer";
import { useAdminProjects, useAdminCPs } from "@/lib/hooks";
import { Download } from "lucide-react";

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

interface EOIRecord {
  id: string;
  referenceNumber?: string;
  status: string;
  journeyStatus: string;
  customerName: string;
  customerEmail: string;
  project: string;
  cpName: string;
  chequeUploaded: boolean;
  chequeNumber?: string;
  submittedAt?: string;
}

export default function AdminEOIsPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [chequeFilter, setChequeFilter] = useState("");
  const [cpFilter, setCpFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [reviewId, setReviewId] = useState<string | null>(null);

  const { data: projectsData } = useAdminProjects();
  const { data: cpsData } = useAdminCPs();

  const queryParams = new URLSearchParams();
  if (statusFilter) queryParams.set("status", statusFilter);
  if (chequeFilter) queryParams.set("cheque", chequeFilter);
  if (cpFilter) queryParams.set("cpId", cpFilter);
  if (projectFilter) queryParams.set("projectId", projectFilter);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "all-eois", statusFilter, chequeFilter, cpFilter, projectFilter],
    queryFn: () => fetcher<EOIRecord[]>(`/api/admin/eois?${queryParams.toString()}`),
  });

  const projects = (projectsData as { id: string; name: string }[]) || [];
  const cps = (cpsData as { id: string; name: string }[]) || [];

  if (isLoading) return <div className="space-y-6"><LoadingSkeleton rows={6} /></div>;

  const hasActiveFilters = !!(statusFilter || chequeFilter || cpFilter || projectFilter);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer EOIs"
        description="All expression of interest submissions across projects and channel partners."
        breadcrumb={[
          { label: "Dashboard", href: "/admin" },
          { label: "Customer EOIs" },
        ]}
        actions={
          <Button variant="outline" size="sm" onClick={() => window.open("/api/admin/export?type=eois&format=csv", "_blank")}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />

      <DataTable<EOIRecord>
        columns={[
          { key: "referenceNumber", header: "EOI Ref", render: (r) => r.referenceNumber || "—" },
          { key: "customerName", header: "Customer" },
          { key: "project", header: "Project" },
          { key: "cpName", header: "Channel Partner" },
          { key: "journeyStatus", header: "Status", render: (r) => <StatusBadge status={r.journeyStatus || r.status} /> },
          { key: "chequeUploaded", header: "Cheque", render: (r) => (
            <div>
              <StatusBadge status={r.chequeUploaded ? "APPROVED" : "PENDING"} />
              {r.chequeNumber && <span className="text-xs text-muted-foreground ml-1">#{r.chequeNumber}</span>}
            </div>
          )},
          { key: "submittedAt", header: "Submitted", render: (r) =>
            r.submittedAt ? new Date(r.submittedAt).toLocaleDateString("en-IN") : "—"
          },
        ]}
        data={data || []}
        emptyTitle="No EOIs yet"
        onRowClick={(row) => setReviewId(row.id)}
        filterActions={
          hasActiveFilters ? (
            <Button variant="ghost" size="sm" onClick={() => {
              setStatusFilter("");
              setChequeFilter("");
              setCpFilter("");
              setProjectFilter("");
            }}>
              Clear filters
            </Button>
          ) : undefined
        }
        filters={
          <>
            <Select
              label=""
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              options={[
                { value: "", label: "All Projects" },
                ...projects.map((p) => ({ value: p.id, label: p.name })),
              ]}
              className="w-44"
            />
            <Select
              label=""
              value={cpFilter}
              onChange={(e) => setCpFilter(e.target.value)}
              options={[
                { value: "", label: "All CPs" },
                ...cps.map((cp) => ({ value: cp.id, label: cp.name })),
              ]}
              className="w-44"
            />
            <Select
              label=""
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: "", label: "All Statuses" },
                { value: "SUBMITTED", label: "Submitted" },
                { value: "UNDER_REVIEW", label: "Under Review" },
                { value: "APPROVED", label: "Approved" },
                { value: "REJECTED", label: "Rejected" },
                { value: "DRAFT", label: "Draft" },
              ]}
              className="w-44"
            />
            <Select
              label=""
              value={chequeFilter}
              onChange={(e) => setChequeFilter(e.target.value)}
              options={[
                { value: "", label: "All Cheques" },
                { value: "uploaded", label: "Cheque Uploaded" },
                { value: "missing", label: "Cheque Missing" },
              ]}
              className="w-44"
            />
          </>
        }
      />

      <EoiVerificationDrawer eoiId={reviewId} onClose={() => setReviewId(null)} />
    </div>
  );
}
