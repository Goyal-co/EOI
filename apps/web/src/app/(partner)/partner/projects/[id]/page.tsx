"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Button, StatusBadge, Card, CardSkeleton, EmptyState, formatCurrency, formatDate,
  PageHeader, Tabs, TabsList, TabsTrigger, TabsContent,
} from "@goyal/ui";
import { MapPin, Calendar } from "lucide-react";
import { usePartnerProject, usePartnerProjects } from "@/lib/hooks";
import { SubmitEOIModal } from "@/components/submit-eoi-modal";
import { PunchLeadModal } from "@/components/punch-lead-modal";
import { ProjectAssetsPanel, type ProjectAssetTab } from "@/components/project-assets-panel";

function resolveProjectRouteId(
  paramsId: string | string[] | undefined,
  pathname: string,
  searchProjectId: string | null,
) {
  const fromParams = decodeURIComponent(
    String(Array.isArray(paramsId) ? paramsId[0] : paramsId || ""),
  ).trim();
  if (fromParams && fromParams !== "undefined" && fromParams !== "null") return fromParams;

  const fromQuery = decodeURIComponent(String(searchProjectId || "")).trim();
  if (fromQuery && fromQuery !== "undefined" && fromQuery !== "null") return fromQuery;

  const parts = pathname.split("/").filter(Boolean);
  const projectsIdx = parts.findIndex((p) => p === "projects");
  const fromPath = projectsIdx >= 0 ? decodeURIComponent(parts[projectsIdx + 1] || "").trim() : "";
  if (fromPath && fromPath !== "undefined" && fromPath !== "null") return fromPath;
  return "";
}

interface ProjectAsset {
  id: string;
  type: string;
  fileName: string;
  fileUrl: string;
}

interface Project {
  id: string;
  name: string;
  location: string;
  locationLink?: string | null;
  locationImageUrl?: string | null;
  startingPrice: number;
  eoiStatus: string;
  eoiFormFiller?: "CUSTOMER" | "CP";
  status: string;
  tags?: string[];
  bannerUrl?: string;
  description?: string;
  amenities?: string[];
  possessionDate?: string;
  faqs?: Array<{ question: string; answer: string }>;
  assets: ProjectAsset[];
  myLeads: number;
}

const ASSET_TABS = ["walkthrough", "brochure", "floor-plans", "cost-sheet", "gallery", "creatives"] as const;

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const pathname = usePathname() || "";
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = resolveProjectRouteId(params?.id, pathname, searchParams.get("projectId") || searchParams.get("id"));
  // List is the reliable source for existing projects; by-id refreshes assets/creatives.
  const listQuery = usePartnerProjects({ refetchOnMount: "always" });
  const detailQuery = usePartnerProject(id || undefined);
  const [eoiOpen, setEoiOpen] = useState(false);
  const [punchOpen, setPunchOpen] = useState(false);

  const activeTab = searchParams.get("tab") || "overview";
  const projectFromList = useMemo(() => {
    const rows = (listQuery.data as Project[] | undefined) || [];
    const needle = id.toLowerCase();
    return (
      rows.find((p) => p.id === id)
      || rows.find((p) => p.id?.toLowerCase() === needle)
      || rows.find((p) => p.name?.toLowerCase() === needle)
    );
  }, [listQuery.data, id]);
  const projectFromDetail = detailQuery.data as Project | undefined;
  // Prefer freshest assets from by-id when present; otherwise use list (existing projects).
  const project = projectFromDetail || projectFromList;

  const refetchDetail = detailQuery.refetch;
  const refetchList = listQuery.refetch;
  useEffect(() => {
    if (activeTab !== "creatives") return;
    void refetchDetail();
    void refetchList();
    const timer = setInterval(() => {
      void refetchDetail();
      void refetchList();
    }, 10000);
    return () => clearInterval(timer);
  }, [activeTab, refetchDetail, refetchList]);

  const listSettled = !listQuery.isLoading && !listQuery.isFetching;
  const detailSettled = !detailQuery.isLoading && !detailQuery.isFetching;
  const stillLoading = Boolean(id) && !project && (!listSettled || !detailSettled);

  const creativeCount = useMemo(
    () => (project?.assets || []).filter((a) => String(a.type || "").toUpperCase() === "CREATIVE").length,
    [project?.assets],
  );

  const setTab = (tab: string) => {
    router.replace(`/partner/projects/${id}?tab=${tab}`, { scroll: false });
  };

  if (!id) {
    return (
      <EmptyState
        title="Project not found"
        description="This link is missing the project id. Open the project again from Projects — existing projects already have ids; you do not need to recreate them."
        actionLabel="Back to Projects"
        onAction={() => router.push("/partner/projects")}
      />
    );
  }

  if (stillLoading) {
    return (
      <div className="space-y-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (!project) {
    const errMsg =
      (detailQuery.error instanceof Error && detailQuery.error.message)
      || (listQuery.error instanceof Error && listQuery.error.message)
      || "This project may not be assigned to your partner account. Ask admin to assign it — you do not need to recreate the project.";
    return (
      <EmptyState
        title="Project not found"
        description={errMsg}
        actionLabel="Back to Projects"
        onAction={() => router.push("/partner/projects")}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={project.name}
        description={project.location}
        breadcrumb={[
          { label: "Projects", href: "/partner/projects" },
          { label: project.name },
        ]}
        actions={
          <div className="flex items-center gap-3">
            <StatusBadge status={project.eoiStatus === "OPEN" ? "OPEN" : "CLOSED_PROJECT"} />
            {project.eoiStatus === "OPEN" ? (
              <Button variant="gold" onClick={() => setEoiOpen(true)}>
                Submit EOI
              </Button>
            ) : (
              <Button variant="gold" onClick={() => setPunchOpen(true)}>
                Punch Lead
              </Button>
            )}
          </div>
        }
      />

      {(project.tags?.length ?? 0) > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {project.tags!.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-md border border-gold/30 bg-gold-light/60 px-2 py-0.5 text-[11px] font-medium text-navy"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      <div className="relative rounded-xl overflow-hidden aspect-[16/5] bg-gradient-to-br from-blue-100 to-blue-200">
        {project.bannerUrl ? (
          <img src={project.bannerUrl} alt={project.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-6xl font-bold text-blue-600/20">
            {project.name.charAt(0)}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-0 left-0 p-6 text-white">
          <div className="flex items-center gap-4 text-sm text-white/80">
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {project.locationLink ? (
                <a href={project.locationLink} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {project.location}
                </a>
              ) : (
                project.location
              )}
            </span>
            <span className="font-medium text-gold">From {formatCurrency(project.startingPrice)} / sqft</span>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setTab}>
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="walkthrough">Walkthrough</TabsTrigger>
          <TabsTrigger value="location">Location</TabsTrigger>
          <TabsTrigger value="brochure">Brochure</TabsTrigger>
          <TabsTrigger value="floor-plans">Floor Plans</TabsTrigger>
          <TabsTrigger value="cost-sheet">Cost Sheet</TabsTrigger>
          <TabsTrigger value="gallery">Gallery</TabsTrigger>
          <TabsTrigger value="creatives">
            Creatives{creativeCount > 0 ? ` (${creativeCount})` : ""}
          </TabsTrigger>
          <TabsTrigger value="faqs">FAQs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2 p-6">
              <h3 className="text-section-title mb-3">About</h3>
              {project.description ? (
                <p className="text-sm text-muted-foreground leading-relaxed">{project.description}</p>
              ) : (
                <EmptyState title="No description" description="Project details will appear here once added by admin." />
              )}
              {project.amenities && project.amenities.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-section-title mb-3">Amenities</h4>
                  <div className="flex flex-wrap gap-2">
                    {project.amenities.map((a) => (
                      <span key={a} className="rounded-full bg-blue-50 px-3 py-1 text-xs text-foreground">{a}</span>
                    ))}
                  </div>
                </div>
              )}
            </Card>
            <Card className="p-6 space-y-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Location</p>
                <p className="text-sm font-medium text-foreground mt-1 flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {project.locationLink ? (
                    <a href={project.locationLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {project.location}
                    </a>
                  ) : (
                    project.location
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Price per sqft</p>
                <p className="text-xl font-bold text-gold mt-1">{formatCurrency(project.startingPrice)} / sqft</p>
              </div>
              {project.possessionDate && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Possession</p>
                  <p className="text-sm font-medium text-foreground mt-1 flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {formatDate(project.possessionDate)}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Your Leads</p>
                <p className="text-sm font-medium text-foreground mt-1">{project.myLeads}</p>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="location">
          <Card className="p-6 space-y-4">
            <h3 className="text-section-title">Location</h3>
            <p className="text-sm text-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              {project.location}
            </p>
            {project.locationImageUrl ? (
              project.locationLink ? (
                <a
                  href={project.locationLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-xl border border-border hover:opacity-95 transition-opacity"
                >
                  <img
                    src={project.locationImageUrl}
                    alt={`${project.name} location`}
                    className="aspect-video w-full bg-blue-50 object-contain"
                  />
                  <p className="px-3 py-2 text-xs text-blue-600">Open in Maps</p>
                </a>
              ) : (
                <img
                  src={project.locationImageUrl}
                  alt={`${project.name} location`}
                  className="aspect-video w-full rounded-xl border border-border bg-blue-50 object-contain"
                />
              )
            ) : project.locationLink ? (
              <a
                href={project.locationLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex text-sm text-blue-600 hover:underline"
              >
                Open in Maps
              </a>
            ) : (
              <EmptyState
                title="No location details"
                description="Admin can add a location image and/or map link for this project."
              />
            )}
          </Card>
        </TabsContent>

        {ASSET_TABS.map((tabId) => (
          <TabsContent key={tabId} value={tabId}>
            <ProjectAssetsPanel
              assets={project.assets || []}
              tab={tabId as ProjectAssetTab}
              downloadApiPrefix="/api/partner/assets"
            />
          </TabsContent>
        ))}

        <TabsContent value="faqs">
          <Card className="p-6">
            {(project.faqs?.length ?? 0) > 0 ? (
              <div className="space-y-2">
                {project.faqs!.map((faq) => (
                  <details key={faq.question} className="group rounded-lg border border-border">
                    <summary className="cursor-pointer px-4 py-3 text-section-title list-none flex items-center justify-between">
                      {faq.question}
                      <span className="text-muted-foreground text-xs group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <p className="px-4 pb-4 text-sm text-muted-foreground">{faq.answer}</p>
                  </details>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No FAQs yet"
                description="Frequently asked questions will appear here once added by admin."
              />
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <SubmitEOIModal
        open={eoiOpen}
        onOpenChange={setEoiOpen}
        projectId={project.id}
        projectName={project.name}
        eoiFormFiller={project.eoiFormFiller}
      />
      <PunchLeadModal
        open={punchOpen}
        onOpenChange={setPunchOpen}
        projectId={project.id}
        projectName={project.name}
      />
    </div>
  );
}
