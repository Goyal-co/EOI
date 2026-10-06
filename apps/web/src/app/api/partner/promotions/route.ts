import { prisma } from "@goyal/db";
import { withPartnerAuth, apiResponse, requireApprovedCP, withApiRoute } from "@/lib/api";

export const GET = withApiRoute("partner.promotions.list", async () => {
  const { error, session } = await withPartnerAuth();
  if (error) return error;
  const cpError = await requireApprovedCP(session!);
  if (cpError) return cpError;

  const now = new Date();
  const rows = await prisma.partnerPromotion.findMany({
    where: {
      active: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      mediaUrl: true,
      mediaKind: true,
      linkUrl: true,
      sortOrder: true,
    },
  });

  return apiResponse(rows);
});
