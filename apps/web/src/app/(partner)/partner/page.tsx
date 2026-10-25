"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  StatCard, ProjectCard, CardSkeleton, DataTable, JourneyStatusBadge, formatDate, PageHeader, Select, Input, FilterBar,
} from "@goyal/ui";
import {
  UserCheck, FileText, CheckCircle, XCircle, Clock, Send,
} from "lucide-react";
import { usePartnerAnalytics, usePartnerProjects, usePartnerLeads, usePartnerFosNames } from "@/lib/hooks";
import { partnerVisibleJourneyStatus } from "@/lib/partner-visible-status";
import { SubmitEOIModal } from "@/components/submit-eoi-modal";
import { PunchLeadModal } from "@/components/punch-lead-modal";
import { PartnerPromoCarousel } from "@/components/partner-promo-carousel";
import { useRequirePartnerAccess } from "@/lib/use-require-partner";

interface PartnerAnalytics {
  totalLeads: { value: number; growth: number };
  eoiPendingCustomer: { value: number; growth: number };
  confirmationPending: { value: number; growth: number };
  submittedEOIs: { value: number; growth: number };
  approvedEOIs: { value: number; growth: number };
  rejectedEOIs: { value: number; growth: number };
}

interface Project {
  id: string;
  name: string;
  location: string;
  startingPrice: number;
  eoiStatus: string;
  eoiFormFiller?: "CUSTOMER" | "CP";
  tags?: string[];
  bannerUrl?: string;
  myLeads: number;
}

interface LeadRow {
  id: string;
  customerName: string;
  journeyStatus: string;
  confirmationSentAt?: string | null;
  fosName?: string | null;
  projectId?: string;
  createdAt: string;
}

const KPI_CONFIG = [
  { key: "totalLeads" as const, title: "Total Leads", icon: UserCheck, href: "/partner/leads" },
  { key: "submittedEOIs" as const, title: "EOI's Submitted", icon: FileText, href: "/partner/eois?status=submitted" },
  { key: "eoiPendingCustomer" as const, title: "EOI's Pending (Customer)", icon: Clock, href: "/partner/leads?status=DRAFT" },
  { key: "confirmationPending" as const, title: "EOI's Confirmation Pending", icon: Send, href: "/partner/leads?status=CONFIRMATION_PENDING" },
  { key: "approvedEOIs" as const, title: "Approved EOI's", icon: CheckCircle, href: "/partner/eois?status=APPROVED" },
  { key: "rejectedEOIs" as const, title: "Rejected EOI's", icon: XCircle, href: "/partner/eois?status=REJECTED" },
];

export default function PartnerDashboardPage() {
  const router = useRouter();
  const { isOwner } = useRequirePartnerAccess();
  const { data: analytics, isLoading: analyticsLoading } = usePartnerAnalytics();
  const { data: projects, isLoading: projectsLoading } = usePartnerProjects();
  const [projectFilter, setProjectFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [eoiModal, setEoiModal] = useState<{
    open: boolean;
    projectId: string;
    projectName: string;
    eoiFormFiller?: "CUSTOMER" | "CP";
  }>({
    open: false,
    projectId: "",
    projectName: "",
  });
  const [punchModal, setPunchModal] = useState<{ open: boolean; projectId: string; projectName: string }>({
    open: false,
    projectId: "",
    projectName: "",
  });
  const [mapSeed, setMapSeed] = useState<{
    customerName: string;
    mobile: string;
    email: string;
    configuration?: string;
    fosName?: string;
    budget?: string;
    city?: string;
    notes?: string;
  } | null>(null);

  const leadFilters = useMemo(() => {
    const f: Record<string, string> = {};
    if (projectFilter) f.projectId = projectFilter;
    if (fromDate) f.fromDate = fromDate;
    if (toDate) f.toDate = toDate;
    if (teamFilter) f.fosName = teamFilter;
    return f;
  }, [projectFilter, fromDate, toDate, teamFilter]);

  const { data: leadsData, isLoading: leadsLoading } = usePartnerLeads({
    ...leadFilters,
    pageSize: "20",
  });
  const { data: fosNames } = usePartnerFosNames(isOwner);
  const stats = analytics as PartnerAnalytics | undefined;
  const projectList = (projects as Project[] | undefined) || [];
  const allLeads = (leadsData?.items || []) as unknown as LeadRow[];
  const recentLeads = allLeads.slice(0, 8);

  const teamOptions = useMemo(() => [...(fosNames || [])].sort(), [fosNames]);

  const filteredProjects = projectFilter
    ? projectList.filter((p) => p.id === projectFilter)
    : projectList;

  const leadFiltersBar = (
    <FilterBar className="mb-3">
      <div className="grid w-full grid-cols-2 gap-2 sm:contents">
        <div className="col-span-2 min-w-0 sm:col-auto sm:w-48">
          <Select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            options={[
              { value: "", label: "All Projects" },
              ...projectList.map((p) => ({ value: p.id, label: p.name })),
            ]}
            aria-label="Filter by project"
          />
        </div>
        <div className="min-w-0 sm:w-36">
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            aria-label="From date"
          />
        </div>
        <div className="min-w-0 sm:w-36">
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            aria-label="To date"
          />
        </div>
        {isOwner && (
          <div className="col-span-2 min-w-0 sm:col-auto sm:w-44">
            <Select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              options={[
                { value: "", label: "All Teams (FOS)" },
                ...teamOptions.map((name) => ({ value: name, label: name })),
              ]}
              aria-label="Filter by team"
            />
          </div>
        )}
      </div>
    </FilterBar>
  );

  return (
    <div className="space-y-5 pb-28 sm:space-y-6 sm:pb-24">
      {/* Hero: promotions first so they are never pushed below filters */}
      <PartnerPromoCarousel />

      <PageHeader
        title="Dashboard"
        description="Overview of your partner activity"
        className="mb-0"
      />

      {/* KPIs immediately after header — primary dashboard signal */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {analyticsLoading ? (
          Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)
        ) : (
          KPI_CONFIG.map(({ key, title, icon, href }) => (
            <StatCard
              key={key}
              title={title}
              value={stats?.[key]?.value ?? 0}
              icon={icon}
              growth={stats?.[key]?.growth}
              onClick={() => router.push(href)}
              className="min-w-0"
            />
          ))
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-section-title">Your Projects</h2>
          <button
            onClick={() => router.push("/partner/projects")}
            className="text-sm text-blue-600 hover:underline"
          >
            View all
          </button>
        </div>

        {projectsLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.slice(0, 6).map((project) => (
              <ProjectCard
                key={project.id}
                name={project.name}
                location={project.location}
                imageUrl={project.bannerUrl}
                startingPrice={project.startingPrice}
                eoiStatus={project.eoiStatus}
                tags={project.tags}
                totalLeads={project.myLeads}
                onViewDetails={() => router.push(`/partner/projects/${project.id}`)}
                onSubmitEOI={project.eoiStatus === "OPEN" ? () => setEoiModal({
                  open: true,
                  projectId: project.id,
                  projectName: project.name,
                  eoiFormFiller: project.eoiFormFiller,
                }) : undefined}
                onPunchLead={project.eoiStatus !== "OPEN" ? () => setPunchModal({ open: true, projectId: project.id, projectName: project.name }) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* Filters scoped to leads only — does not compete with promo/KPIs */}
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-section-title">Recent Leads</h2>
          <button
            onClick={() => router.push("/partner/leads")}
            className="text-sm text-blue-600 hover:underline"
          >
            View all
          </button>
        </div>
        {leadFiltersBar}
        <div className="lg:hidden space-y-3">
          {leadsLoading ? (
            <CardSkeleton />
          ) : recentLeads.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No leads yet
            </div>
          ) : (
            recentLeads.map((lead) => {
              const status = partnerVisibleJourneyStatus(lead.journeyStatus);
              return (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => router.push("/partner/leads")}
                  className="flex w-full items-start justify-between gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-sm"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{lead.customerName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {lead.confirmationSentAt ? `Sent ${formatDate(lead.confirmationSentAt)}` : "No confirmation sent"}
                    </p>
                  </div>
                  {status ? <JourneyStatusBadge status={status} /> : null}
                </button>
              );
            })
          )}
        </div>
        <div className="hidden lg:block">
          <DataTable
            columns={[
              { key: "customerName", header: "Customer" },
              {
                key: "journeyStatus",
                header: "Journey Status",
                render: (row) => {
                  const status = partnerVisibleJourneyStatus(row.journeyStatus);
                  return status ? (
                    <JourneyStatusBadge status={status} />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  );
                },
              },
              {
                key: "confirmationSentAt",
                header: "Confirmation Sent",
                render: (row) => row.confirmationSentAt ? formatDate(row.confirmationSentAt) : "—",
              },
            ]}
            data={recentLeads}
            loading={leadsLoading}
            emptyTitle="No leads yet"
            emptyDescription="Submit an EOI to register your first lead"
            onRowClick={() => router.push("/partner/leads")}
          />
        </div>
      </div>

      <SubmitEOIModal
        open={eoiModal.open}
        onOpenChange={(open) => {
          setEoiModal((prev) => ({ ...prev, open }));
          if (!open) setMapSeed(null);
        }}
        projectId={eoiModal.projectId}
        projectName={eoiModal.projectName}
        eoiFormFiller={eoiModal.eoiFormFiller}
        initialLead={mapSeed || undefined}
        onMapToProject={(project, seed) => {
          setMapSeed(seed);
          setEoiModal({ open: false, projectId: "", projectName: "" });
          if (project.action === "EOI") {
            setEoiModal({
              open: true,
              projectId: project.id,
              projectName: project.name,
            });
          } else {
            setPunchModal({ open: true, projectId: project.id, projectName: project.name });
          }
        }}
      />
      <PunchLeadModal
        open={punchModal.open}
        onOpenChange={(open) => {
          setPunchModal((prev) => ({ ...prev, open }));
          if (!open) setMapSeed(null);
        }}
        projectId={punchModal.projectId}
        projectName={punchModal.projectName}
        initialLead={mapSeed || undefined}
        onMapToProject={(project, seed) => {
          setMapSeed(seed);
          setPunchModal({ open: false, projectId: "", projectName: "" });
          if (project.action === "EOI") {
            setEoiModal({ open: true, projectId: project.id, projectName: project.name });
          } else {
            setPunchModal({ open: true, projectId: project.id, projectName: project.name });
          }
        }}
      />
    </div>
  );
}
