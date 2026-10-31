import { prisma } from "@goyal/db";
import { withPartnerAuth, apiResponse, requireApprovedCP, withApiRoute } from "@/lib/api";
import { resolveProjectBannerUrl } from "@/lib/project-banner";
import { leadScopeWhereAsync } from "@/lib/partner-scope";

async function safeBannerUrl(url: string | null | undefined) {
  try {
    return await resolveProjectBannerUrl(url);
  } catch {
    return url || null;
  }
}

export const GET = withApiRoute("partner.projects.get", async (req: Request) => {
  const { error, session } = await withPartnerAuth();
  if (error) return error;
  const cpError = await requireApprovedCP(session!);
  if (cpError) return cpError;

  const cpId = session!.user.cpId!;
  const slim = new URL(req.url).searchParams.get("slim") === "1";

  if (slim) {
    const access = await prisma.cPProjectAccess.findMany({
      where: { cpId },
      select: {
        project: {
          select: {
            id: true,
            name: true,
            eoiStatus: true,
            eoiFormFiller: true,
            status: true,
            unitPreferences: true,
          },
        },
      },
    });
    return apiResponse(
      access.map((a) => ({
        id: a.project.id,
        name: a.project.name,
        eoiStatus: a.project.eoiStatus,
        eoiFormFiller: a.project.eoiFormFiller,
        status: a.project.status,
        unitPreferences: a.project.unitPreferences,
      })),
    );
  }

  const leadWhere = await leadScopeWhereAsync(session!);
  const access = await prisma.cPProjectAccess.findMany({
    where: { cpId },
    include: {
      project: {
        include: {
          // All asset types for OPEN and CLOSED — do not filter by eoiStatus.
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

  return apiResponse(
    await Promise.all(
      access.map(async (a) => ({
        id: a.project.id,
        name: a.project.name,
        location: a.project.location,
        locationLink: a.project.locationLink,
        startingPrice: Number(a.project.startingPrice),
        eoiStatus: a.project.eoiStatus,
        eoiFormFiller: a.project.eoiFormFiller,
        status: a.project.status,
        tags: a.project.tags ?? [],
        bannerUrl: await safeBannerUrl(a.project.bannerUrl),
        locationImageUrl: await safeBannerUrl(a.project.locationImageUrl),
        description: a.project.description,
        amenities: a.project.amenities,
        possessionDate: a.project.possessionDate,
        faqs: (a.project.faqs as Array<{ question: string; answer: string }> | null) || [],
        unitPreferences: a.project.unitPreferences,
        assets: a.project.assets.map((asset) => ({
          id: asset.id,
          type: asset.type,
          fileName: asset.fileName,
          fileUrl: asset.fileUrl,
          fileSize: asset.fileSize,
        })),
        myLeads: leadsByProject.get(a.project.id) ?? 0,
      })),
    ),
  );
});
