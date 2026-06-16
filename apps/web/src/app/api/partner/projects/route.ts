import { prisma } from "@goyal/db";
import { withAuth, apiResponse, requireApprovedCP } from "@/lib/api";

export async function GET() {
  const { error, session } = await withAuth(["CHANNEL_PARTNER"]);
  if (error) return error;
  const cpError = await requireApprovedCP(session!);
  if (cpError) return cpError;

  const cpId = session!.user.cpId!;

  const access = await prisma.cPProjectAccess.findMany({
    where: { cpId },
    include: {
      project: {
        include: {
          assets: true,
          _count: { select: { leads: { where: { cpId } } } },
        },
      },
    },
  });

  return apiResponse(access.map((a) => ({
    id: a.project.id,
    name: a.project.name,
    location: a.project.location,
    startingPrice: Number(a.project.startingPrice),
    eoiStatus: a.project.eoiStatus,
    status: a.project.status,
    bannerUrl: a.project.bannerUrl,
    description: a.project.description,
    amenities: a.project.amenities,
    possessionDate: a.project.possessionDate,
    faqs: (a.project.faqs as Array<{ question: string; answer: string }> | null) || [],
    assets: a.project.assets,
    myLeads: a.project._count.leads,
  })));
}
