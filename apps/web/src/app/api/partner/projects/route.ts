import { prisma } from "@goyal/db";
import { withPartnerAuth, apiResponse, requireApprovedCP, withApiRoute } from "@/lib/api";
import { resolveProjectBannerUrl } from "@/lib/project-banner";
import { leadScopeWhere } from "@/lib/partner-scope";

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
        status: a.project.status,
        unitPreferences: a.project.unitPreferences,
      })),
    );
  }

  const access = await prisma.cPProjectAccess.findMany({
    where: { cpId },
    include: {
      project: {
        include: {
          assets: true,
          _count: { select: { leads: { where: { cpId, ...leadScopeWhere(session!) } } } },
        },
      },
    },
  });

  return apiResponse(
    await Promise.all(
      access.map(async (a) => ({
        id: a.project.id,
        name: a.project.name,
        location: a.project.location,
        locationLink: a.project.locationLink,
        startingPrice: Number(a.project.startingPrice),
        eoiStatus: a.project.eoiStatus,
        status: a.project.status,
        tags: a.project.tags ?? [],
        bannerUrl: await resolveProjectBannerUrl(a.project.bannerUrl),
        locationImageUrl: await resolveProjectBannerUrl(a.project.locationImageUrl),
        description: a.project.description,
        amenities: a.project.amenities,
        possessionDate: a.project.possessionDate,
        faqs: (a.project.faqs as Array<{ question: string; answer: string }> | null) || [],
        unitPreferences: a.project.unitPreferences,
        assets: a.project.assets,
        myLeads: a.project._count.leads,
      }))
    )
  );
});
