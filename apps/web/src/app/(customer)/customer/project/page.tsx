"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Card, CardContent, StatusBadge, CardSkeleton, EmptyState,
  formatCurrency, formatDate, PageHeader, Tabs, TabsList, TabsTrigger, TabsContent,
} from "@goyal/ui";
import { useCustomerDashboard } from "@/lib/hooks";
import { useCustomerEoiId } from "@/components/customer/project-switcher";
import { ProjectAssetsPanel, type ProjectAssetTab } from "@/components/project-assets-panel";
import { MapPin, CheckCircle2, Sparkles } from "lucide-react";

const ASSET_TABS: ProjectAssetTab[] = ["brochure", "floor-plans", "cost-sheet", "gallery"];

function CustomerProjectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eoiId = useCustomerEoiId();
  const { data, isLoading } = useCustomerDashboard(eoiId);

  const activeTab = searchParams.get("tab") || "overview";

  const setTab = (tab: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`/customer/project?${params.toString()}`, { scroll: false });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <CardSkeleton />
      </div>
    );
  }

  if (!data?.hasEOI) {
    return (
      <div className="space-y-6">
        <EmptyState title="No Project Assigned" description="Complete your invitation to view project details." />
      </div>
    );
  }

  const { project } = data;
  if (!project) {
    return (
      <div className="space-y-6">
        <EmptyState title="No Project Assigned" description="Project details are not available yet." />
      </div>
    );
  }

  const amenities = project.amenities || [];
  const faqs = project.faqs || [];
  const assets = (project as { assets?: Array<{ id: string; type: string; fileName: string; fileUrl: string }> }).assets || [];

  return (
    <div className="space-y-6">
      <div className="relative h-64 rounded-xl overflow-hidden bg-gradient-to-br from-navy/10 via-blue-100 to-gold-light shadow-md">
        {project.bannerUrl ? (
          <img src={project.bannerUrl} alt={project.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-6xl font-bold text-blue-600/20">
            {project.name.charAt(0)}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        <div className="absolute top-4 right-4">
          <StatusBadge status={project.eoiStatus === "OPEN" ? "OPEN" : "CLOSED_PROJECT"} />
        </div>
        <div className="absolute bottom-0 left-0 p-6 text-white">
          <p className="text-2xl font-bold">{project.name}</p>
          <p className="text-sm text-white/80 flex items-center gap-1 mt-1">
            <MapPin className="h-4 w-4" />
            {project.location}
          </p>
        </div>
      </div>

      <PageHeader
        title={project.name}
        description={
          project.possessionDate
            ? `${project.location} · Possession ${formatDate(project.possessionDate)}`
            : project.location
        }
        actions={
          <span className="font-medium text-gold whitespace-nowrap">
            Starting {formatCurrency(project.startingPrice)}
          </span>
        }
      />

      <Tabs value={activeTab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="amenities">Amenities</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="brochure">Brochure</TabsTrigger>
          <TabsTrigger value="floor-plans">Floor Plans</TabsTrigger>
          <TabsTrigger value="cost-sheet">Cost Sheet</TabsTrigger>
          <TabsTrigger value="gallery">Gallery</TabsTrigger>
          <TabsTrigger value="faqs">FAQs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardContent className="p-6">
              {project.description ? (
                <p className="text-muted-foreground leading-relaxed">{project.description}</p>
              ) : (
                <EmptyState
                  title="No description"
                  description="Project details will appear here once available."
                  icon={<Sparkles className="h-8 w-8 text-muted-foreground" />}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="amenities">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {amenities.length > 0 ? (
              amenities.map((amenity) => (
                <Card key={amenity} className="border-l-2 border-l-emerald-400">
                  <CardContent className="p-4 flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                    <span className="text-sm text-foreground">{amenity}</span>
                  </CardContent>
                </Card>
              ))
            ) : (
              <p className="text-muted-foreground col-span-full">Amenities information coming soon.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="details">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Project Name</p>
                  <p className="font-medium text-foreground">{project.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Location</p>
                  <p className="font-medium text-foreground flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {project.location}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Starting Price</p>
                  <p className="font-medium text-gold">{formatCurrency(project.startingPrice)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">EOI Status</p>
                  <StatusBadge status={project.eoiStatus === "OPEN" ? "OPEN" : "CLOSED_PROJECT"} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {ASSET_TABS.map((tabId) => (
          <TabsContent key={tabId} value={tabId}>
            <ProjectAssetsPanel
              assets={assets}
              tab={tabId}
              downloadApiPrefix="/api/customer/assets"
            />
          </TabsContent>
        ))}

        <TabsContent value="faqs">
          <Card className="p-6">
            {faqs.length > 0 ? (
              <div className="space-y-2">
                {faqs.map((faq) => (
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
              <EmptyState title="No FAQs yet" description="Frequently asked questions will appear here once added." />
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function CustomerProjectPage() {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <CustomerProjectContent />
    </Suspense>
  );
}
