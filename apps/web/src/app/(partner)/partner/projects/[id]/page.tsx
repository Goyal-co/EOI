"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Button, StatusBadge, Card, CardSkeleton, EmptyState, formatCurrency, formatDate,
  PageHeader, Tabs, TabsList, TabsTrigger, TabsContent,
} from "@goyal/ui";
import { MapPin, Calendar } from "lucide-react";
import { usePartnerProjects } from "@/lib/hooks";
import { SubmitEOIModal } from "@/components/submit-eoi-modal";
import { PunchLeadModal } from "@/components/punch-lead-modal";
import { ProjectAssetsPanel, type ProjectAssetTab } from "@/components/project-assets-panel";

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
  startingPrice: number;
  eoiStatus: string;
  status: string;
  bannerUrl?: string;
  description?: string;
  amenities?: string[];
  possessionDate?: string;
  faqs?: Array<{ question: string; answer: string }>;
  assets: ProjectAsset[];
  myLeads: number;
}

const ASSET_TABS = ["brochure", "floor-plans", "cost-sheet", "gallery"] as const;

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, isLoading } = usePartnerProjects();
  const [eoiOpen, setEoiOpen] = useState(false);
  const [punchOpen, setPunchOpen] = useState(false);

  const activeTab = searchParams.get("tab") || "overview";

  const project = useMemo(
    () => (data as Project[] | undefined)?.find((p) => p.id === id),
    [data, id]
  );

  const setTab = (tab: string) => {
    router.replace(`/partner/projects/${id}?tab=${tab}`, { scroll: false });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (!project) {
    return (
      <EmptyState
        title="Project not found"
        description="This project may not be assigned to you"
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
          project.eoiStatus === "OPEN" ? (
            <Button variant="gold" onClick={() => setEoiOpen(true)}>
              Submit EOI
            </Button>
          ) : (
            <Button variant="gold" onClick={() => setPunchOpen(true)}>
              Punch Lead
            </Button>
          )
        }
      />

      <div className="relative rounded-xl overflow-hidden h-56 bg-gradient-to-br from-blue-100 to-blue-200">
        {project.bannerUrl ? (
          <img src={project.bannerUrl} alt={project.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-6xl font-bold text-blue-600/20">
            {project.name.charAt(0)}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-0 left-0 p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <StatusBadge status={project.eoiStatus === "OPEN" ? "OPEN" : "CLOSED_PROJECT"} />
          </div>
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
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="brochure">Brochure</TabsTrigger>
          <TabsTrigger value="floor-plans">Floor Plans</TabsTrigger>
          <TabsTrigger value="cost-sheet">Cost Sheet</TabsTrigger>
          <TabsTrigger value="gallery">Gallery</TabsTrigger>
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
