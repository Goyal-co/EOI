"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProjectCard, CardSkeleton, EmptyState, PageHeader } from "@goyal/ui";
import { usePartnerProjects } from "@/lib/hooks";
import { SubmitEOIModal } from "@/components/submit-eoi-modal";

interface Project {
  id: string;
  name: string;
  location: string;
  startingPrice: number;
  eoiStatus: string;
  bannerUrl?: string;
  myLeads: number;
}

export default function PartnerProjectsPage() {
  const router = useRouter();
  const { data, isLoading } = usePartnerProjects();
  const projects = (data as Project[] | undefined) || [];
  const [eoiModal, setEoiModal] = useState({ open: false, projectId: "", projectName: "" });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Browse projects assigned to you"
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState title="No projects assigned" description="Contact admin to get access to projects" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              name={project.name}
              location={project.location}
              imageUrl={project.bannerUrl}
              startingPrice={project.startingPrice}
              eoiStatus={project.eoiStatus}
              totalLeads={project.myLeads}
              onViewDetails={() => router.push(`/partner/projects/${project.id}`)}
              onViewBrochure={() => router.push(`/partner/projects/${project.id}?tab=brochure`)}
              onSubmitEOI={() => setEoiModal({ open: true, projectId: project.id, projectName: project.name })}
            />
          ))}
        </div>
      )}

      <SubmitEOIModal
        open={eoiModal.open}
        onOpenChange={(open) => setEoiModal((prev) => ({ ...prev, open }))}
        projectId={eoiModal.projectId}
        projectName={eoiModal.projectName}
      />
    </div>
  );
}
