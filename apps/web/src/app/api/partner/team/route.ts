import { prisma } from "@goyal/db";
import { cpTeamMemberCreateSchema } from "@goyal/types";
import { withAuth, apiResponse, apiError, requireApprovedCP, withApiRoute } from "@/lib/api";
import { computeTeamMemberPerformance } from "@/lib/services/team-members";

export const GET = withApiRoute("partner.team.list", async (req: Request) => {
  const { error, session } = await withAuth(["CHANNEL_PARTNER"]);
  if (error) return error;
  const cpError = await requireApprovedCP(session!);
  if (cpError) return cpError;

  const cpId = session!.user.cpId!;
  const url = new URL(req.url);
  const fromDate = url.searchParams.get("fromDate");
  const toDate = url.searchParams.get("toDate");
  const from = fromDate ? new Date(fromDate) : undefined;
  const to = toDate ? new Date(toDate) : undefined;
  if (to) to.setHours(23, 59, 59, 999);

  const members = await prisma.cPTeamMember.findMany({
    where: { cpId },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });

  const withPerformance = await Promise.all(
    members.map(async (member) => ({
      ...member,
      performance: await computeTeamMemberPerformance(cpId, member.id, from, to),
    })),
  );

  return apiResponse(withPerformance);
});

export const POST = withApiRoute("partner.team.create", async (req: Request) => {
  const { error, session } = await withAuth(["CHANNEL_PARTNER"]);
  if (error) return error;
  const cpError = await requireApprovedCP(session!);
  if (cpError) return cpError;

  const body = await req.json().catch(() => null);
  const parsed = cpTeamMemberCreateSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0].message);

  const cpId = session!.user.cpId!;
  const member = await prisma.cPTeamMember.create({
    data: {
      cpId,
      name: parsed.data.name.trim(),
      email: parsed.data.email?.trim() || null,
      mobile: parsed.data.mobile?.trim() || null,
      role: parsed.data.role?.trim() || null,
    },
  });

  return apiResponse(member, 201);
});
