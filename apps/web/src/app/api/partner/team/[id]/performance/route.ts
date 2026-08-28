import { withAuth, apiResponse, apiError, requireApprovedCP, withApiRoute } from "@/lib/api";
import { computeTeamMemberPerformance } from "@/lib/services/team-members";
import { prisma } from "@goyal/db";

export const GET = withApiRoute("partner.team.performance", async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { error, session } = await withAuth(["CHANNEL_PARTNER"]);
  if (error) return error;
  const cpError = await requireApprovedCP(session!);
  if (cpError) return cpError;

  const { id } = await params;
  const cpId = session!.user.cpId!;
  const member = await prisma.cPTeamMember.findFirst({ where: { id, cpId } });
  if (!member) return apiError("Team member not found", 404);

  const url = new URL(req.url);
  const fromDate = url.searchParams.get("fromDate");
  const toDate = url.searchParams.get("toDate");
  const from = fromDate ? new Date(fromDate) : undefined;
  const to = toDate ? new Date(toDate) : undefined;
  if (to) to.setHours(23, 59, 59, 999);

  const performance = await computeTeamMemberPerformance(cpId, id, from, to);
  return apiResponse({ member, performance });
});
