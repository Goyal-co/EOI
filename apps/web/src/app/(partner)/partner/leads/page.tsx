"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  DataTable, Drawer, StatusBadge, Select, Button, Input, formatDate, useToast, PageHeader, LoadingSkeleton,
} from "@goyal/ui";
import { Mail, Phone, MapPin, Copy, Send } from "lucide-react";
import { usePartnerLeads, usePartnerProjects } from "@/lib/hooks";

interface Lead {
  id: string;
  customerName: string;
  customerEmail: string;
  customerMobile: string;
  configuration?: string;
  budget?: string;
  city?: string;
  notes?: string;
  leadStatus: string;
  journeyStatus?: string;
  intentType?: string;
  confirmationStatus?: string | null;
  siteVisitStatus?: string;
  createdAt: string;
  project: { name: string };
  eoi?: { status: string; referenceNumber?: string; chequeUploaded?: boolean };
}

interface Project {
  id: string;
  name: string;
}

function PartnerLeadsContent() {
  const searchParams = useSearchParams();
  const [projectFilter, setProjectFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");
  const [intentFilter, setIntentFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [sendingConfirmation, setSendingConfirmation] = useState(false);
  const [canExport, setCanExport] = useState(false);
  const { addToast } = useToast();
  const qc = useQueryClient();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    const status = searchParams.get("status");
    if (status) setStatusFilter(status);
  }, [searchParams]);

  useEffect(() => {
    fetch("/api/partner/settings")
      .then((r) => r.json())
      .then((data) => setCanExport(!!data.permissions?.cpCanExportLeads))
      .catch(() => {});
  }, []);

  const filters = useMemo(() => {
    const f: Record<string, string> = {};
    if (projectFilter) f.projectId = projectFilter;
    if (statusFilter) f.status = statusFilter;
    if (intentFilter) f.intentType = intentFilter;
    if (debouncedSearch) f.search = debouncedSearch;
    if (fromDate) f.fromDate = fromDate;
    if (toDate) f.toDate = toDate;
    return f;
  }, [projectFilter, statusFilter, intentFilter, debouncedSearch, fromDate, toDate]);

  const { data, isLoading } = usePartnerLeads(filters);
  const { data: projects } = usePartnerProjects();
  const leads = (data as Lead[] | undefined) || [];
  const projectList = (projects as Project[] | undefined) || [];

  const copyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    addToast({ type: "info", title: "Copied", message: "Email copied to clipboard" });
  };

  const canSendConfirmation = (lead: Lead) =>
    !lead.confirmationStatus || lead.confirmationStatus === "PENDING";

  const handleSendConfirmation = async (leadId: string) => {
    setSendingConfirmation(true);
    try {
      const res = await fetch(`/api/partner/leads/${leadId}/send-confirmation`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send confirmation");
      addToast({ type: "success", title: "Confirmation sent", message: "Customer will receive an email to accept the association." });
      await qc.invalidateQueries({ queryKey: ["partner", "leads"] });
      setSelectedLead(null);
    } catch (e) {
      addToast({ type: "error", title: "Failed", message: (e as Error).message });
    } finally {
      setSendingConfirmation(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Leads"
        description="Track and manage your registered leads"
        actions={
          canExport ? (
            <Button variant="outline" size="sm" onClick={() => window.open("/api/partner/leads/export", "_blank")}>
              Export CSV
            </Button>
          ) : undefined
        }
      />

      <DataTable<Lead>
        columns={[
          { key: "customerName", header: "Customer", render: (row) => (
            <div>
              <p className="font-medium">{row.customerName}</p>
              <p className="text-xs text-muted-foreground">{row.customerEmail}</p>
            </div>
          )},
          { key: "project", header: "Project", render: (row) => row.project.name },
          { key: "intentType", header: "Type", render: (row) => (
            <StatusBadge status={row.intentType === "LEAD_ONLY" ? "LEAD_ONLY" : "EOI"} />
          )},
          { key: "customerMobile", header: "Mobile" },
          { key: "leadStatus", header: "Status", render: (row) => (
            <StatusBadge status={row.journeyStatus || row.leadStatus} />
          )},
          { key: "eoi", header: "EOI Status", render: (row) => (
            row.intentType === "LEAD_ONLY"
              ? <span className="text-muted-foreground">N/A</span>
              : row.eoi
                ? <StatusBadge status={row.eoi.status} />
                : <span className="text-muted-foreground">—</span>
          )},
          { key: "siteVisitStatus", header: "Site Visit", render: (row) => <StatusBadge status={row.siteVisitStatus || "NOT_SCHEDULED"} /> },
          { key: "createdAt", header: "Date", render: (row) => formatDate(row.createdAt) },
        ]}
        data={leads}
        loading={isLoading}
        emptyTitle="No leads yet"
        emptyDescription="Submit an EOI to register your first lead"
        onRowClick={setSelectedLead}
        filters={
          <div className="flex flex-col gap-3 w-full">
            <Input
              placeholder="Search by name, email, or mobile..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-md"
            />
            <div className="flex flex-wrap gap-3">
            <Select
              label=""
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              options={[
                { value: "", label: "All Projects" },
                ...projectList.map((p) => ({ value: p.id, label: p.name })),
              ]}
              className="w-48"
            />
            <Select
              label=""
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: "", label: "All Statuses" },
                { value: "DRAFT", label: "Draft" },
                { value: "CONFIRMATION_PENDING", label: "Confirmation Pending" },
                { value: "ACTIVE", label: "Active" },
                { value: "SUBMITTED", label: "Submitted" },
                { value: "APPROVED", label: "Approved" },
                { value: "REJECTED", label: "Rejected" },
                { value: "CORRECTION_PENDING", label: "Correction Pending" },
                { value: "LEAD_CONFIRMED", label: "Lead Confirmed" },
              ]}
              className="w-48"
            />
            <Select
              label=""
              value={intentFilter}
              onChange={(e) => setIntentFilter(e.target.value)}
              options={[
                { value: "", label: "All Types" },
                { value: "EOI", label: "EOI" },
                { value: "LEAD_ONLY", label: "Lead Only" },
              ]}
              className="w-40"
            />
            <Input
              type="date"
              label=""
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-40"
            />
            <Input
              type="date"
              label=""
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-40"
            />
            {(projectFilter || statusFilter || intentFilter || debouncedSearch || fromDate || toDate) && (
              <Button variant="ghost" size="sm" onClick={() => {
                setProjectFilter("");
                setStatusFilter("");
                setIntentFilter("");
                setSearchQuery("");
                setFromDate("");
                setToDate("");
              }}>
                Clear filters
              </Button>
            )}
            </div>
          </div>
        }
      />

      <Drawer
        open={!!selectedLead}
        onClose={() => setSelectedLead(null)}
        title="Lead Details"
      >
        {selectedLead && (
          <div className="space-y-6">
            <div>
              <h3 className="text-section-title">{selectedLead.customerName}</h3>
              <div className="flex items-center gap-2 mt-2">
                <StatusBadge status={selectedLead.intentType === "LEAD_ONLY" ? "LEAD_ONLY" : "EOI"} />
                <StatusBadge status={selectedLead.journeyStatus || selectedLead.leadStatus} />
                {selectedLead.confirmationStatus && (
                  <StatusBadge status={selectedLead.confirmationStatus} />
                )}
                {selectedLead.eoi && selectedLead.intentType !== "LEAD_ONLY" && <StatusBadge status={selectedLead.eoi.status} />}
              </div>
            </div>

            {canSendConfirmation(selectedLead) && (
              <Button
                variant="gold"
                loading={sendingConfirmation}
                onClick={() => handleSendConfirmation(selectedLead.id)}
              >
                <Send className="h-4 w-4" /> Send Confirmation
              </Button>
            )}

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{selectedLead.customerEmail}</span>
                <Button variant="ghost" size="sm" onClick={() => copyEmail(selectedLead.customerEmail)}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{selectedLead.customerMobile}</span>
              </div>
              {selectedLead.city && (
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedLead.city}</span>
                </div>
              )}
            </div>

            <div className="rounded-lg bg-blue-50 p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Project</span><span className="font-medium">{selectedLead.project.name}</span></div>
              {selectedLead.configuration && <div className="flex justify-between"><span className="text-muted-foreground">Configuration</span><span className="font-medium">{selectedLead.configuration}</span></div>}
              {selectedLead.budget && <div className="flex justify-between"><span className="text-muted-foreground">Budget</span><span className="font-medium">{selectedLead.budget}</span></div>}
              <div className="flex justify-between"><span className="text-muted-foreground">Registered</span><span className="font-medium">{formatDate(selectedLead.createdAt)}</span></div>
            </div>

            <Select
              label="Site Visit Status"
              value={selectedLead.siteVisitStatus || "NOT_SCHEDULED"}
              onChange={async (e) => {
                const res = await fetch(`/api/partner/leads/${selectedLead.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ siteVisitStatus: e.target.value }),
                });
                if (res.ok) {
                  await qc.invalidateQueries({ queryKey: ["partner", "leads"] });
                  setSelectedLead({ ...selectedLead, siteVisitStatus: e.target.value });
                  addToast({ type: "success", title: "Site visit updated" });
                }
              }}
              options={[
                { value: "NOT_SCHEDULED", label: "Not Scheduled" },
                { value: "SCHEDULED", label: "Scheduled" },
                { value: "COMPLETED", label: "Completed" },
                { value: "CANCELLED", label: "Cancelled" },
              ]}
            />

            {selectedLead.notes && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Notes</p>
                <p className="text-sm text-foreground">{selectedLead.notes}</p>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}

export default function PartnerLeadsPage() {
  return (
    <Suspense fallback={<LoadingSkeleton rows={8} />}>
      <PartnerLeadsContent />
    </Suspense>
  );
}
