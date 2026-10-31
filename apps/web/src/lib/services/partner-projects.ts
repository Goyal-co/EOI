import { prisma } from "@goyal/db";
import type { Session } from "next-auth";
import { resolveProjectBannerUrl } from "@/lib/project-banner";
import { leadScopeWhereAsync } from "@/lib/partner-scope";

async function safeBannerUrl(url: string | null | undefined) {
  try {
    return await resolveProjectBannerUrl(url);
  } catch {
    return url || null;
  }
}

type PartnerSession = Session & {
  user: Session["user"] & { cpId?: string; teamMemberId?: string };
};

async function mapPartnerProject(
  project: {
    id: string;
    name: string;
    location: string;
    locationLink: string | null;
    startingPrice: unknown;
    eoiStatus: string;
    eoiFormFiller: string;
    status: string;
    tags: string[];
    bannerUrl: string | null;
    locationImageUrl: string | null;
    description: string | null;
    amenities: string[];
    possessionDate: Date | null;
    faqs: unknown;
    unitPreferences: unknown;
    assets: Array<{
      id: string;
      type: string;
      fileName: string;
      fileUrl: string;
      fileSize: number | null;
    }>;
  },
  myLeads: number,
) {
  return {
    id: project.id,
    name: project.name,
    location: project.location,
    locationLink: project.locationLink,
    startingPrice: Number(project.startingPrice),
    eoiStatus: project.eoiStatus,
    eoiFormFiller: project.eoiFormFiller,
    status: project.status,
    tags: project.tags ?? [],
    bannerUrl: await safeBannerUrl(project.bannerUrl),
    locationImageUrl: await safeBannerUrl(project.locationImageUrl),
    description: project.description,
    amenities: project.amenities,
    possessionDate: project.possessionDate,
    faqs: (project.faqs as Array<{ question: string; answer: string }> | null) || [],
    unitPreferences: project.unitPreferences,
    assets: project.assets.map((asset) => ({
      id: asset.id,
      type: asset.type,
      fileName: asset.fileName,
      fileUrl: asset.fileUrl,
      fileSize: asset.fileSize,
    })),
    myLeads,
  };
}

const accessInclude = {
  project: {
    include: {
      assets: { orderBy: { createdAt: "desc" as const } },
    },
  },
} as const;

/** One assigned project for a CP — same for OPEN and CLOSED, existing and new.
 *  Every Project row has a non-null id (PK). Lookup is by id first; name is a
 *  fallback for stale links — never requires recreating the project. */
export async function getAssignedPartnerProject(session: PartnerSession, projectId: string) {
  const cpId = session.user.cpId!;
  const id = projectId.trim();
  if (!id) return { error: "Project id is required" as const, status: 400 as const, project: null };

  let access = await prisma.cPProjectAccess.findFirst({
    where: { cpId, projectId: id },
    include: accessInclude,
  });

  // Stale bookmarks / bad client params sometimes send the project name.
  if (!access?.project) {
    access = await prisma.cPProjectAccess.findFirst({
      where: {
        cpId,
        project: { name: { equals: id, mode: "insensitive" } },
      },
      include: accessInclude,
    });
  }

  if (!access?.project) {
    const exists = await prisma.project.findFirst({
      where: {
        OR: [
          { id },
          { name: { equals: id, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    if (exists) {
      return {
        error: "Project exists but is not assigned to your partner account" as const,
        status: 404 as const,
        project: null,
      };
    }
    return { error: "Project not found or not assigned" as const, status: 404 as const, project: null };
  }

  const resolvedId = access.project.id;
  const leadWhere = await leadScopeWhereAsync(session);
  const myLeads = await prisma.lead.count({
    where: { cpId, projectId: resolvedId, ...leadWhere },
  });

  return {
    error: null,
    status: 200 as const,
    project: await mapPartnerProject(access.project, myLeads),
  };
}

export async function listAssignedPartnerProjects(session: PartnerSession) {
  const cpId = session.user.cpId!;
  const leadWhere = await leadScopeWhereAsync(session);

  const access = await prisma.cPProjectAccess.findMany({
    where: { cpId },
    include: {
      project: {
        include: {
          assets: { orderBy: { createdAt: "desc" } },
        },
      },
    },
  });

  const leadCounts = await prisma.lead.groupBy({
    by: ["projectId"],
    where: { cpId, ...leadWhere },
    _count: { _all: true },
  });
  const leadsByProject = new Map(leadCounts.map((row) => [row.projectId, row._count._all]));

  const mapped = await Promise.all(
    access
      .filter((a) => Boolean(a.project?.id))
      .map((a) => mapPartnerProject(a.project, leadsByProject.get(a.project.id) ?? 0)),
  );
  return mapped;
}
