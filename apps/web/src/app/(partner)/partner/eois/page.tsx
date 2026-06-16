"use client";

import { useState } from "react";
import {
  DataTable, StatusBadge, Card, CardSkeleton, EmptyState, formatDate, cn, PageHeader,
} from "@goyal/ui";
import { LayoutGrid, List } from "lucide-react";
import { usePartnerEOIs } from "@/lib/hooks";

interface EOI {
  id: string;
  status: string;
  createdAt: string;
  submittedAt?: string;
  confirmationNumber?: string;
  lead: { customerName: string; customerEmail: string };
  project: { name: string };
}

export default function PartnerEOIsPage() {
  const { data, isLoading } = usePartnerEOIs();
  const eois = (data as EOI[] | undefined) || [];
  const [view, setView] = useState<"cards" | "table">("cards");

  return (
    <div className="space-y-6">
      <PageHeader
        title="My EOIs"
        description="Track expression of interest submissions"
        actions={
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
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : eois.length === 0 ? (
        <EmptyState title="No EOIs yet" description="Submit an EOI from a project page to get started" />
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
            { key: "confirmationNumber", header: "Confirmation", render: (row) => row.confirmationNumber || "—" },
            { key: "createdAt", header: "Created", render: (row) => formatDate(row.createdAt) },
            { key: "submittedAt", header: "Submitted", render: (row) => row.submittedAt ? formatDate(row.submittedAt) : "—" },
          ]}
          data={eois}
        />
      )}
    </div>
  );
}
