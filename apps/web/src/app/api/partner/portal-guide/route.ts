import { prisma } from "@goyal/db";
import { withPartnerAuth, apiResponse, requireApprovedCP, withApiRoute } from "@/lib/api";

export const GET = withApiRoute("partner.portalGuide.list", async () => {
  const { error, session } = await withPartnerAuth();
  if (error) return error;
  const cpError = await requireApprovedCP(session!);
  if (cpError) return cpError;

  const rows = await prisma.portalGuideVideo.findMany({
    where: { active: true },
    orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
  });

  const featured = rows.find((r) => r.featured) ?? rows[0] ?? null;
  const guides = rows.filter((r) => !featured || r.id !== featured.id);

  return apiResponse({ featured, guides, videos: rows });
});
