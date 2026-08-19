"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import {
  DataTable,
  StatusBadge,
  Select,
  PageHeader,
  Modal,
  Input,
  Button,
  LoadingSkeleton,
  useToast,
} from "@goyal/ui";
import { Trash2 } from "lucide-react";
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
    companyName?: string | null;
    intentType: string;
    journeyStatus: string;
    siteVisitStatus: string;
    siteVisitDate?: string | null;
    confirmationStatus: string | null;
    createdAt: string;
  }[];
  timeline: {
    id: string;
    type: string;
    occurredAt: string;
    actorType: string | null;
    cpName: string | null;
    companyName?: string | null;
    projectName: string | null;
    salesperson?: string | null;
    summary?: string;
    metadata: unknown;
  }[];
}

const EVENT_LABELS: Record<string, string> = {
  PUNCHED: "Lead punched",
  MAPPED: "Mapped to project",
  CONFIRMED: "Customer confirmed",
  REJECTED: "Customer rejected",
  SITE_VISIT: "Site visit completed",
  BOOKED: "Booking confirmed",
  LOCK_STARTED: "15-day lock started",
  CP_ATTACHED: "New CP attached",
};

const HISTORY_FILTER_LABELS: Record<string, string> = {
  PUNCHED: "Punched",
  MAPPED: "Mapped",
  CP_ATTACHED: "CP attached",
  SITE_VISIT: "Site visit",
  BOOKED: "Booked",
  CONFIRMED: "Confirmed",
};

const EVENT_COLORS: Record<string, string> = {
  PUNCHED: "bg-sky-500",
  MAPPED: "bg-indigo-500",
  CONFIRMED: "bg-emerald-500",
  REJECTED: "bg-rose-500",
  SITE_VISIT: "bg-amber-500",
  BOOKED: "bg-green-600",
  LOCK_STARTED: "bg-orange-500",
  CP_ATTACHED: "bg-violet-500",
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.json()).error || "Request failed");
  return res.json();
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function AdminLeadsContent() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState({
    projectId: "",
    cpId: "",
    q: searchParams.get("q") || searchParams.get("search") || "",
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IdentityRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<string>("ALL");

  useEffect(() => {
    const q = searchParams.get("q") || searchParams.get("search");
    if (q) setFilters((f) => ({ ...f, q }));
  }, [searchParams]);

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

  // Auto-open history when deep-linked with a single Lead ID match
  useEffect(() => {
    if (!filters.q.trim() || !rows.length || selectedId) return;
    const exact = rows.find(
      (r) => r.leadId.toLowerCase() === filters.q.trim().toLowerCase(),
    );
    if (exact) setSelectedId(exact.id);
    else if (rows.length === 1) setSelectedId(rows[0].id);
  }, [rows, filters.q, selectedId]);

  const filteredTimeline = useMemo(() => {
    if (!detail?.timeline) return [];
    if (historyFilter === "ALL") return detail.timeline;
    return detail.timeline.filter((e) => e.type === historyFilter);
  }, [detail, historyFilter]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/lead-identities/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Failed to delete lead");
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin", "lead-identities"] }),
        qc.invalidateQueries({ queryKey: ["admin", "lead-identity", deleteTarget.id] }),
      ]);
      if (selectedId === deleteTarget.id) {
        setSelectedId(null);
        setHistoryFilter("ALL");
      }
      addToast({
        type: "success",
        title: "Lead deleted",
        message: `${deleteTarget.leadId} and its related history were removed.`,
      });
      setDeleteTarget(null);
    } catch (e) {
      addToast({ type: "error", title: "Delete failed", message: (e as Error).message });
    } finally {
      setDeleting(false);
    }
  };

  const filterBar = (
    <div className="flex flex-wrap items-end gap-4 w-full min-w-0">
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
        description="Open any lead to see full history — punches, CPs, site visits, and bookings"
      />

      <DataTable
        columns={[
          { key: "leadId", header: "Lead ID" },
          { key: "customerName", header: "Customer" },
          { key: "primaryPhone", header: "Mobile" },
          { key: "primaryEmail", header: "Email" },
          {
            key: "associationCount",
            header: "CPs / Projects",
            render: (row) => String((row as IdentityRow).associationCount),
          },
          {
            key: "eventCount",
            header: "History",
            render: (row) => {
              const n = (row as IdentityRow).eventCount;
              return n ? `${n} events` : "—";
            },
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
              <div className="flex items-center justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedId((row as IdentityRow).id)}
                >
                  View history
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDeleteTarget(row as IdentityRow)}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
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
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null);
            setHistoryFilter("ALL");
          }
        }}
        title={detail ? `Lead history · ${detail.leadId}` : "Lead history"}
        size="xl"
      >
        {detailLoading || !detail ? (
          <LoadingSkeleton rows={8} />
        ) : (
          <div className="space-y-6 pr-1">
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Customer</div>
                  <div className="mt-0.5 text-base font-semibold">{detail.customerName || "—"}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Lead ID</div>
                  <div className="mt-0.5 font-mono text-base font-semibold">{detail.leadId}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Phone</div>
                  <div className="mt-0.5 font-medium">{detail.primaryPhone}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Email</div>
                  <div className="mt-0.5 break-all font-medium">{detail.primaryEmail}</div>
                </div>
              </div>
              <div className="mt-3 rounded-lg border border-border bg-background px-3 py-2 text-sm">
                {detail.lock.active ? (
                  <span>
                    15-day protection active — <strong>{detail.lock.lockDaysRemaining}</strong> day(s) left
                    {detail.lock.lockExpiresAt
                      ? ` (until ${formatWhen(detail.lock.lockExpiresAt)})`
                      : ""}
                  </span>
                ) : detail.lock.cooldownDaysRemaining > 0 ? (
                  <span>
                    Prior-CP cooldown — <strong>{detail.lock.cooldownDaysRemaining}</strong> day(s) left
                  </span>
                ) : (
                  <span className="text-muted-foreground">No active lock or cooldown</span>
                )}
              </div>
            </div>

            <section>
              <h3 className="mb-2 text-sm font-semibold">Associated channel partners</h3>
              <div className="space-y-2">
                {detail.partners.map((p) => (
                  <div key={p.cpId} className="rounded-lg border border-border p-3 text-sm">
                    <div className="font-medium">
                      {p.name}
                      {p.companyName ? (
                        <span className="text-muted-foreground"> · {p.companyName}</span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Projects: {p.projects.join(", ") || "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      First punch {formatWhen(p.firstPunchedAt)} · Last {formatWhen(p.lastPunchedAt)}
                    </div>
                  </div>
                ))}
                {!detail.partners.length && (
                  <p className="text-sm text-muted-foreground">No partners linked yet.</p>
                )}
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold">CP × project associations</h3>
              <div className="space-y-2">
                {detail.associations.map((a) => (
                  <div
                    key={a.id}
                    className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border p-3 text-sm"
                  >
                    <div>
                      <div className="font-medium">{a.projectName}</div>
                      <div className="text-xs text-muted-foreground">
                        CP: {a.cpName || "—"}
                        {a.companyName ? ` (${a.companyName})` : ""}
                        {" · "}
                        {a.intentType}
                      </div>
                      {a.siteVisitDate ? (
                        <div className="text-xs text-muted-foreground">
                          Site visit: {formatWhen(String(a.siteVisitDate))}
                        </div>
                      ) : null}
                      <div className="text-xs text-muted-foreground">
                        Punched {formatWhen(a.createdAt)}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge status={a.journeyStatus} />
                      <StatusBadge status={a.siteVisitStatus} />
                      {a.confirmationStatus ? <StatusBadge status={a.confirmationStatus} /> : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="min-w-0">
              <h3 className="text-sm font-semibold">
                  Full history
                  <span className="ml-2 font-normal text-muted-foreground">
                    ({detail.timeline.length} events)
                  </span>
              </h3>
              <div className="mt-2 flex w-full min-w-0 flex-wrap gap-1.5 rounded-lg border border-border bg-muted/50 p-2">
                  {[
                    "ALL",
                    "PUNCHED",
                    "MAPPED",
                    "CP_ATTACHED",
                    "SITE_VISIT",
                    "BOOKED",
                    "CONFIRMED",
                  ].map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setHistoryFilter(key)}
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition ${
                        historyFilter === key
                          ? "border-navy bg-navy text-white"
                          : "border-border bg-white text-navy hover:bg-blue-50"
                      }`}
                    >
                      {key === "ALL" ? "All" : HISTORY_FILTER_LABELS[key] || EVENT_LABELS[key] || key}
                    </button>
                  ))}
              </div>

              {filteredTimeline.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  No history events{historyFilter !== "ALL" ? " for this filter" : ""} yet.
                </p>
              ) : (
                <ol className="space-y-0 border-l-2 border-border pl-4">
                  {filteredTimeline.map((event) => (
                    <li key={event.id} className="relative pb-5 last:pb-0">
                      <span
                        className={`absolute -left-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-background ${
                          EVENT_COLORS[event.type] || "bg-primary"
                        }`}
                      />
                      <div className="rounded-lg border border-border bg-background p-3 text-sm shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold">
                            {EVENT_LABELS[event.type] || event.type.replace(/_/g, " ")}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatWhen(event.occurredAt)}
                          </span>
                        </div>
                        <dl className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                          <div>
                            <dt className="text-muted-foreground">Channel Partner</dt>
                            <dd className="font-medium">
                              {event.cpName || event.companyName || "—"}
                              {event.cpName && event.companyName && event.companyName !== event.cpName
                                ? ` · ${event.companyName}`
                                : ""}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">Project</dt>
                            <dd className="font-medium">{event.projectName || "—"}</dd>
                          </div>
                          {event.salesperson ? (
                            <div>
                              <dt className="text-muted-foreground">Salesperson</dt>
                              <dd className="font-medium">{event.salesperson}</dd>
                            </div>
                          ) : null}
                          {event.actorType ? (
                            <div>
                              <dt className="text-muted-foreground">Source</dt>
                              <dd className="font-medium">{event.actorType}</dd>
                            </div>
                          ) : null}
                        </dl>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}
      </Modal>

      <Modal
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete Lead"
        description={
          deleteTarget
            ? `Delete ${deleteTarget.leadId}? This removes the lead, any linked EOIs, and its full history.`
            : undefined
        }
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" loading={deleting} onClick={handleDelete}>
              Delete Lead
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function AdminLeadsPage() {
  return (
    <Suspense fallback={<LoadingSkeleton rows={8} />}>
      <AdminLeadsContent />
    </Suspense>
  );
}
