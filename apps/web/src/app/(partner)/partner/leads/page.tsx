"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  DataTable, Drawer, StatusBadge, Select, Button, Input, formatDate, useToast, PageHeader, LoadingSkeleton,
} from "@goyal/ui";
import { Clock, Copy, Layers3, Mail, MapPin, Phone, Send } from "lucide-react";
import { usePartnerLeads, usePartnerProjects } from "@/lib/hooks";
import { SubmitEOIModal } from "@/components/submit-eoi-modal";
import { PunchLeadModal } from "@/components/punch-lead-modal";

interface AvailableProject {
  id: string;
  name: string;
  location: string;
  eoiStatus: string;
  action: "EOI" | "LEAD_ONLY";
}

interface Lead {
  id: string;
  leadId?: string | null;
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
  siteVisitDate?: string | null;
  fosName?: string | null;
  createdAt: string;
  lockExpiresAt?: string;
  lockDaysRemaining?: number;
  availableProjects?: AvailableProject[];
  project: { id?: string; name: string };
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
  const [teamFilter, setTeamFilter] = useState("");
  const [siteVisitDate, setSiteVisitDate] = useState("");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [crossProject, setCrossProject] = useState<AvailableProject | null>(null);
  const [now, setNow] = useState(Date.now());
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

  useEffect(() => {
    if (!selectedLead?.lockExpiresAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [selectedLead?.lockExpiresAt]);

  const lockCountdown = (expiresAt?: string) => {
    if (!expiresAt) return "—";
    const remaining = Math.max(0, new Date(expiresAt).getTime() - now);
    if (remaining === 0) return "Unlocked";
    const days = Math.floor(remaining / 86_400_000);
    const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
    const minutes = Math.floor((remaining % 3_600_000) / 60_000);
    const seconds = Math.floor((remaining % 60_000) / 1_000);
    return `${days}d ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  const filters = useMemo(() => {
    const f: Record<string, string> = {};
    if (projectFilter) f.projectId = projectFilter;
    if (statusFilter) f.status = statusFilter;
    if (intentFilter) f.intentType = intentFilter;
    if (debouncedSearch) f.search = debouncedSearch;
    if (fromDate) f.fromDate = fromDate;
    if (toDate) f.toDate = toDate;
    if (teamFilter) f.fosName = teamFilter;
    return f;
  }, [projectFilter, statusFilter, intentFilter, debouncedSearch, fromDate, toDate, teamFilter]);

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
          { key: "leadId", header: "Lead ID", render: (row) => (
            <span className="font-mono text-xs font-medium text-foreground">{row.leadId || "—"}</span>
          )},
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
          { key: "bookingStatus", header: "Booking", render: (row) => (
            row.journeyStatus === "BOOKED" || row.leadStatus === "BOOKED"
              ? <StatusBadge status="BOOKED" />
              : <span className="text-xs text-muted-foreground">Not booked</span>
          )},
          { key: "lockExpiresAt", header: "CP Lock", render: (row) => (
            <span className="text-xs font-medium text-amber-700">
              {row.lockDaysRemaining ? `${row.lockDaysRemaining} day${row.lockDaysRemaining === 1 ? "" : "s"}` : "Unlocked"}
            </span>
          )},
          { key: "createdAt", header: "Date", render: (row) => formatDate(row.createdAt) },
        ]}
        data={leads}
        loading={isLoading}
        emptyTitle="No leads yet"
        emptyDescription="Submit an EOI to register your first lead"
        onRowClick={(lead) => {
          setSelectedLead(lead);
          setSiteVisitDate(
            lead.siteVisitDate
              ? new Date(lead.siteVisitDate).toISOString().slice(0, 10)
              : "",
          );
        }}
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
                { value: "BOOKED", label: "Booked" },
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
                { value: "LEAD_ONLY", label: "Lead" },
              ]}
              className="w-40"
            />
            <Select
              label=""
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              options={[
                { value: "", label: "All Teams (FOS)" },
                ...Array.from(
                  new Set(
                    leads
                      .map((l) => l.fosName?.trim())
                      .filter((n): n is string => !!n),
                  ),
                )
                  .sort()
                  .map((name) => ({ value: name, label: name })),
              ]}
              className="w-48"
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
            {(projectFilter || statusFilter || intentFilter || teamFilter || debouncedSearch || fromDate || toDate) && (
              <Button variant="ghost" size="sm" onClick={() => {
                setProjectFilter("");
                setStatusFilter("");
                setIntentFilter("");
                setTeamFilter("");
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
              {selectedLead.leadId && (
                <p className="mt-1 font-mono text-sm text-muted-foreground">
                  Lead ID: <span className="font-medium text-foreground">{selectedLead.leadId}</span>
                </p>
              )}
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
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Site Visit</span>
                <StatusBadge status={selectedLead.siteVisitStatus || "NOT_SCHEDULED"} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Booking</span>
                {selectedLead.journeyStatus === "BOOKED" || selectedLead.leadStatus === "BOOKED"
                  ? <StatusBadge status="BOOKED" />
                  : <span className="text-xs text-muted-foreground">Not booked</span>}
              </div>
              <div className="flex justify-between"><span className="text-muted-foreground">Registered</span><span className="font-medium">{formatDate(selectedLead.createdAt)}</span></div>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-900">
                <Clock className="h-4 w-4" />
                15-day CP protection
              </div>
              <p className="mt-2 font-mono text-lg font-semibold text-amber-800">
                {lockCountdown(selectedLead.lockExpiresAt)}
              </p>
              <p className="mt-1 text-xs text-amber-700">
                Other CPs cannot register this phone number or email until the timer ends.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Layers3 className="h-4 w-4 text-gold" />
                <h4 className="text-sm font-semibold text-foreground">Punch another project</h4>
              </div>
              {selectedLead.availableProjects?.length ? (
                <div className="space-y-2">
                  {selectedLead.availableProjects.map((project) => (
                    <div
                      key={project.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{project.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {project.location} · {project.eoiStatus === "OPEN" ? "EOI open" : "Lead only"}
                        </p>
                      </div>
                      <Button
                        variant={project.action === "EOI" ? "gold" : "outline"}
                        size="sm"
                        onClick={() => setCrossProject(project)}
                      >
                        {project.action === "EOI" ? "Register EOI" : "Punch Lead"}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  This customer is already mapped to all projects available to you.
                </p>
              )}
            </div>

            <div className="space-y-3">
              {selectedLead.siteVisitStatus === "COMPLETED" ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">Site Visit</p>
                    <StatusBadge status="COMPLETED" />
                  </div>
                  {selectedLead.siteVisitDate && (
                    <p className="text-sm text-muted-foreground">
                      Date: {formatDate(selectedLead.siteVisitDate)}
                    </p>
                  )}
                  <p className="text-xs text-emerald-700">
                    Completed when confirmed by reception.
                  </p>
                </div>
              ) : (
                <>
                  <Input
                    type="date"
                    label="Site Visit Scheduled"
                    value={siteVisitDate}
                    onChange={async (e) => {
                      const date = e.target.value;
                      setSiteVisitDate(date);
                      if (!date) return;
                      const res = await fetch(`/api/partner/leads/${selectedLead.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          siteVisitStatus: "SCHEDULED",
                          siteVisitDate: date,
                        }),
                      });
                      if (res.ok) {
                        const updated = await res.json();
                        await qc.invalidateQueries({ queryKey: ["partner", "leads"] });
                        setSelectedLead({
                          ...selectedLead,
                          siteVisitStatus: updated.siteVisitStatus,
                          siteVisitDate: updated.siteVisitDate,
                        });
                        addToast({
                          type: "success",
                          title: "Site visit scheduled",
                        });
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Pick a date to schedule. Status becomes Completed only when reception confirms the visit.
                  </p>
                  {selectedLead.siteVisitStatus === "SCHEDULED" && (
                    <div className="flex items-center gap-2">
                      <StatusBadge status="SCHEDULED" />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          const res = await fetch(`/api/partner/leads/${selectedLead.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              siteVisitStatus: "NOT_SCHEDULED",
                              siteVisitDate: null,
                            }),
                          });
                          if (res.ok) {
                            setSiteVisitDate("");
                            await qc.invalidateQueries({ queryKey: ["partner", "leads"] });
                            setSelectedLead({
                              ...selectedLead,
                              siteVisitStatus: "NOT_SCHEDULED",
                              siteVisitDate: null,
                            });
                            addToast({ type: "success", title: "Site visit cleared" });
                          }
                        }}
                      >
                        Clear
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>

            {selectedLead.notes && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Notes</p>
                <p className="text-sm text-foreground">{selectedLead.notes}</p>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {selectedLead && crossProject?.action === "EOI" && (
        <SubmitEOIModal
          open
          onOpenChange={(open) => {
            if (!open) {
              setCrossProject(null);
              setSelectedLead(null);
              qc.invalidateQueries({ queryKey: ["partner", "leads"] });
            }
          }}
          projectId={crossProject.id}
          projectName={crossProject.name}
          initialLead={{
            customerName: selectedLead.customerName,
            mobile: selectedLead.customerMobile,
            email: selectedLead.customerEmail,
            configuration: selectedLead.configuration,
            fosName: selectedLead.fosName || undefined,
            budget: selectedLead.budget,
            city: selectedLead.city,
            notes: selectedLead.notes,
          }}
        />
      )}

      {selectedLead && crossProject?.action === "LEAD_ONLY" && (
        <PunchLeadModal
          open
          onOpenChange={(open) => {
            if (!open) {
              setCrossProject(null);
              setSelectedLead(null);
              qc.invalidateQueries({ queryKey: ["partner", "leads"] });
            }
          }}
          projectId={crossProject.id}
          projectName={crossProject.name}
          initialLead={{
            customerName: selectedLead.customerName,
            mobile: selectedLead.customerMobile,
            email: selectedLead.customerEmail,
            configuration: selectedLead.configuration,
            fosName: selectedLead.fosName || undefined,
            budget: selectedLead.budget,
            city: selectedLead.city,
            notes: selectedLead.notes,
          }}
        />
      )}
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
