"use client";

import { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  DataTable, StatusBadge, Card, CardSkeleton, EmptyState, formatDate, cn, PageHeader, Input, LoadingSkeleton,
} from "@goyal/ui";
import { LayoutGrid, List } from "lucide-react";
import { usePartnerEOIs } from "@/lib/hooks";

interface EOI {
  id: string;
  status: string;
  createdAt: string;
  submittedAt?: string;
  confirmationNumber?: string;
  referenceNumber?: string;
  lead: { customerName: string; customerEmail: string };
  project: { name: string };
}

function PartnerEOIsContent() {
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status") || undefined;
  const { data, isLoading } = usePartnerEOIs(statusFilter);
  const allEois = (data as EOI[] | undefined) || [];
  const [view, setView] = useState<"cards" | "table">("cards");
  const [searchQuery, setSearchQuery] = useState("");

  const eois = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allEois;
    return allEois.filter((eoi) =>
      eoi.lead.customerName.toLowerCase().includes(q) ||
      eoi.lead.customerEmail.toLowerCase().includes(q) ||
      eoi.project.name.toLowerCase().includes(q) ||
      eoi.confirmationNumber?.toLowerCase().includes(q) ||
      eoi.referenceNumber?.toLowerCase().includes(q)
    );
  }, [allEois, searchQuery]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My EOIs"
        description="Track expression of interest submissions"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search EOIs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 sm:w-56"
            />
            <div className="flex gap-1 rounded-lg border border-border p-1">
              <button
                onClick={() => setView("cards")}
                className={cn("p-2 rounded-md transition-colors", view === "cards" ? "bg-blue-50 text-foreground" : "text-muted-foreground")}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setView("table")}
                className={cn("p-2 rounded-md transition-colors", view === "table" ? "bg-blue-50 text-foreground" : "text-muted-foreground")}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : eois.length === 0 ? (
        <EmptyState
          title={searchQuery ? "No matching EOIs" : "No EOIs yet"}
          description={searchQuery ? "Try a different search term" : "Submit an EOI from a project page to get started"}
        />
      ) : view === "cards" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {eois.map((eoi) => (
            <Card key={eoi.id} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-section-title">{eoi.lead.customerName}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{eoi.project.name}</p>
                </div>
                <StatusBadge status={eoi.status} />
              </div>
              <div className="space-y-1.5 text-sm text-muted-foreground">
                <p>{eoi.lead.customerEmail}</p>
                <p>Created {formatDate(eoi.createdAt)}</p>
                {eoi.confirmationNumber && (
                  <p className="text-gold font-medium">#{eoi.confirmationNumber}</p>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <DataTable<EOI>
          columns={[
            { key: "customer", header: "Customer", render: (row) => (
              <div>
                <p className="font-medium">{row.lead.customerName}</p>
                <p className="text-xs text-muted-foreground">{row.lead.customerEmail}</p>
              </div>
            )},
            { key: "project", header: "Project", render: (row) => row.project.name },
            { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
            { key: "createdAt", header: "Created", render: (row) => formatDate(row.createdAt) },
            { key: "confirmationNumber", header: "Confirmation #", render: (row) => row.confirmationNumber || "—" },
          ]}
          data={eois}
          loading={isLoading}
          emptyTitle="No EOIs found"
        />
      )}
    </div>
  );
}

export default function PartnerEOIsPage() {
  return (
    <Suspense fallback={<LoadingSkeleton rows={6} />}>
      <PartnerEOIsContent />
    </Suspense>
  );
}
