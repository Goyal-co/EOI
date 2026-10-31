import { prisma } from "@goyal/db";
import { withPartnerAuth, apiResponse, apiError, requireApprovedCP, withApiRoute } from "@/lib/api";
import { resolveProjectBannerUrl } from "@/lib/project-banner";
import { leadScopeWhereAsync } from "@/lib/partner-scope";

async function safeBannerUrl(url: string | null | undefined) {
  try {
    return await resolveProjectBannerUrl(url);
  } catch {
    return url || null;
  }
}

/** Full project detail for partners — assets (including CREATIVE) for OPEN and CLOSED EOI alike. */
export const GET = withApiRoute("partner.projects.id.get", async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { error, session } = await withPartnerAuth();
  if (error) return error;
  const cpError = await requireApprovedCP(session!);
  if (cpError) return cpError;

  const { id: rawId } = await params;
  const id = decodeURIComponent(String(rawId || "")).trim();
  if (!id) return apiError("Project id is required", 400);

  const cpId = session!.user.cpId!;

  // Existing and new projects use the same path — never require recreating a project.
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      // Never filter by eoiStatus — creatives/gallery/etc. must show for OPEN and CLOSED.
      assets: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!project) return apiError("Project not found", 404);

  const access = await prisma.cPProjectAccess.findFirst({
    where: { cpId, projectId: id },
    select: { id: true },
  });
  if (!access) return apiError("Project is not assigned to your partner account", 403);

  const leadWhere = await leadScopeWhereAsync(session!);
  const myLeads = await prisma.lead.count({
    where: { cpId, projectId: id, ...leadWhere },
  });

  return apiResponse({
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
    assets: project.assets.map((a) => ({
      id: a.id,
      type: a.type,
      fileName: a.fileName,
      fileUrl: a.fileUrl,
      fileSize: a.fileSize,
    })),
    myLeads,
  });
});
