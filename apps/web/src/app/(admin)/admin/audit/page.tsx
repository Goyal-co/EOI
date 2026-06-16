"use client";

import { useQuery } from "@tanstack/react-query";
import { DataTable, LoadingSkeleton, formatDate, PageHeader } from "@goyal/ui";

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorName: string;
  ipAddress?: string;
  createdAt: string;
}

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

export default function AdminAuditPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "audit"],
    queryFn: () => fetcher<{ logs: AuditEntry[]; total: number }>("/api/admin/audit"),
  });

  if (isLoading) return <div className="space-y-6"><LoadingSkeleton rows={8} /></div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description={`System activity trail — ${data?.total ?? 0} entries`}
      />

      <DataTable<AuditEntry>
        columns={[
          { key: "createdAt", header: "Time", render: (r) => formatDate(r.createdAt) },
          { key: "action", header: "Action" },
          { key: "entityType", header: "Entity" },
          { key: "entityId", header: "Entity ID", render: (r) => (
            <span className="font-mono text-xs">{r.entityId.slice(0, 12)}…</span>
          )},
          { key: "actorName", header: "Actor" },
          { key: "ipAddress", header: "IP", render: (r) => r.ipAddress || "—" },
        ]}
        data={data?.logs || []}
        emptyTitle="No audit entries yet"
      />
    </div>
  );
}
