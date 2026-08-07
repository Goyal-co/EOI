"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DataTable,
  StatusBadge,
  Select,
  PageHeader,
  Modal,
  Input,
  Button,
  LoadingSkeleton,
} from "@goyal/ui";
import { useAdminProjects, useAdminCPs } from "@/lib/hooks";

interface Project { id: string; name: string }
interface CP { id: string; name: string }

interface IdentityRow {
  id: string;
  leadId: string;
  primaryPhone: string;
  primaryEmail: string;
  customerName: string;
  associationCount: number;
  eventCount: number;
  latestProject: string | null;
  latestCp: string | null;
  latestJourneyStatus: string | null;
  latestSiteVisitStatus: string | null;
  createdAt: string;
}

interface IdentityDetail {
  id: string;
  leadId: string;
  primaryPhone: string;
  primaryEmail: string;
  customerName: string | null;
  lock: {
    active: boolean;
    lockExpiresAt: string | null;
    lockDaysRemaining: number;
    cooldownExpiresAt: string | null;
    cooldownDaysRemaining: number;
  };
  partners: {
    cpId: string;
    name: string;
    companyName: string | null;
    projects: string[];
    firstPunchedAt: string;
    lastPunchedAt: string;
  }[];
  associations: {
    id: string;
    projectName: string;
    cpName: string | null;
    intentType: string;
    journeyStatus: string;
    siteVisitStatus: string;
    confirmationStatus: string | null;
    createdAt: string;
  }[];
  timeline: {
    id: string;
    type: string;
    occurredAt: string;
    actorType: string | null;
    cpName: string | null;
    projectName: string | null;
    metadata: unknown;
  }[];
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.json()).error || "Request failed");
  return res.json();
}

export default function AdminLeadsPage() {
  const [filters, setFilters] = useState({ projectId: "", cpId: "", q: "" });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (filters.projectId) p.set("projectId", filters.projectId);
    if (filters.cpId) p.set("cpId", filters.cpId);
    if (filters.q.trim()) p.set("q", filters.q.trim());
    return p.toString();
  }, [filters]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "lead-identities", params],
    queryFn: () => fetchJson<IdentityRow[]>(`/api/admin/lead-identities?${params}`),
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["admin", "lead-identity", selectedId],
    queryFn: () => fetchJson<IdentityDetail>(`/api/admin/lead-identities/${selectedId}`),
    enabled: !!selectedId,
  });

  const { data: projectsData } = useAdminProjects();
  const { data: cpsData } = useAdminCPs();
  const rows = data || [];
  const projects = (projectsData as Project[]) || [];
  const cps = (cpsData as CP[]) || [];

  const filterBar = (
    <div className="flex flex-wrap gap-4">
      <Input
        label="Search"
        placeholder="Lead ID, phone, email, name"
        value={filters.q}
        onChange={(e) => setFilters({ ...filters, q: e.target.value })}
        className="min-w-[220px]"
      />
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
        label="Channel Partner"
        value={filters.cpId}
        onChange={(e) => setFilters({ ...filters, cpId: e.target.value })}
        options={[
          { value: "", label: "All Partners" },
          ...cps.map((cp) => ({ value: cp.id, label: cp.name })),
        ]}
        className="min-w-[180px]"
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description="Canonical Lead IDs with CP/project history — one customer footprint, many associations"
      />

      <DataTable
        columns={[
          { key: "leadId", header: "Lead ID" },
          { key: "customerName", header: "Customer" },
          { key: "primaryPhone", header: "Mobile" },
          { key: "primaryEmail", header: "Email" },
          {
            key: "associationCount",
            header: "Associations",
            render: (row) => String((row as IdentityRow).associationCount),
          },
          {
            key: "latestProject",
            header: "Latest Project",
            render: (row) => (row as IdentityRow).latestProject || "—",
          },
          {
            key: "latestCp",
            header: "Latest CP",
            render: (row) => (row as IdentityRow).latestCp || "—",
          },
          {
            key: "latestJourneyStatus",
            header: "Status",
            render: (row) =>
              (row as IdentityRow).latestJourneyStatus
                ? <StatusBadge status={(row as IdentityRow).latestJourneyStatus!} />
                : "—",
          },
          {
            key: "actions",
            header: "",
            render: (row) => (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedId((row as IdentityRow).id)}
              >
                History
              </Button>
            ),
          },
        ]}
        data={rows}
        loading={isLoading}
        filters={filterBar}
        emptyTitle="No lead identities found"
        emptyDescription="Try adjusting your filters or wait for channel partners to register leads."
      />

      <Modal
        open={!!selectedId}
        onOpenChange={(open) => { if (!open) setSelectedId(null); }}
        title={detail ? `Lead ${detail.leadId}` : "Lead history"}
        size="lg"
      >
        {detailLoading || !detail ? (
          <LoadingSkeleton rows={6} />
        ) : (
          <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div><span className="text-muted-foreground">Customer</span><div className="font-medium">{detail.customerName || "—"}</div></div>
              <div><span className="text-muted-foreground">Lead ID</span><div className="font-mono font-medium">{detail.leadId}</div></div>
              <div><span className="text-muted-foreground">Phone</span><div>{detail.primaryPhone}</div></div>
              <div><span className="text-muted-foreground">Email</span><div className="break-all">{detail.primaryEmail}</div></div>
            </div>

            <div className="rounded-lg border border-border p-3 text-sm">
              <div className="font-semibold mb-1">Lock / cooldown</div>
              {detail.lock.active ? (
                <p>15-day protection active — {detail.lock.lockDaysRemaining} day(s) left (until {detail.lock.lockExpiresAt ? new Date(detail.lock.lockExpiresAt).toLocaleString("en-IN") : "—"}).</p>
              ) : detail.lock.cooldownDaysRemaining > 0 ? (
                <p>Prior-CP cooldown — {detail.lock.cooldownDaysRemaining} day(s) left.</p>
              ) : (
                <p className="text-muted-foreground">No active lock or cooldown.</p>
              )}
            </div>

            <div>
              <h3 className="font-semibold mb-2">Associated partners</h3>
              <div className="space-y-2">
                {detail.partners.map((p) => (
                  <div key={p.cpId} className="rounded border border-border p-3 text-sm">
                    <div className="font-medium">{p.name}{p.companyName ? ` · ${p.companyName}` : ""}</div>
                    <div className="text-muted-foreground text-xs mt-1">
                      Projects: {p.projects.join(", ") || "—"}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      First punch {new Date(p.firstPunchedAt).toLocaleString("en-IN")} · Last {new Date(p.lastPunchedAt).toLocaleString("en-IN")}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">CP × project associations</h3>
              <div className="space-y-2">
                {detail.associations.map((a) => (
                  <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border p-3 text-sm">
                    <div>
                      <div className="font-medium">{a.projectName}</div>
                      <div className="text-muted-foreground text-xs">{a.cpName || "—"} · {a.intentType}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge status={a.journeyStatus} />
                      <StatusBadge status={a.siteVisitStatus} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Timeline</h3>
              <ol className="space-y-3 border-l border-border pl-4">
                {detail.timeline.map((event) => (
                  <li key={event.id} className="relative text-sm">
                    <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                    <div className="font-medium">{event.type.replace(/_/g, " ")}</div>
                    <div className="text-muted-foreground text-xs">
                      {new Date(event.occurredAt).toLocaleString("en-IN")}
                      {event.cpName ? ` · ${event.cpName}` : ""}
                      {event.projectName ? ` · ${event.projectName}` : ""}
                      {event.actorType ? ` · ${event.actorType}` : ""}
                    </div>
                  </li>
                ))}
                {!detail.timeline.length && (
                  <p className="text-muted-foreground text-sm">No timeline events yet.</p>
                )}
              </ol>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
