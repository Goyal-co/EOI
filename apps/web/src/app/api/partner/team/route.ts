import { prisma } from "@goyal/db";
import { cpTeamMemberCreateSchema } from "@goyal/types";
import {
  withPartnerAuth,
  apiResponse,
  apiError,
  requireApprovedCP,
  requirePartnerOwner,
  withApiRoute,
} from "@/lib/api";
import { computeTeamMemberPerformance, computeTeamRollup } from "@/lib/services/team-members";
import { syncTeamMemberLogin, TeamMemberAuthError } from "@/lib/services/team-member-auth";
import { getPartnerScope } from "@/lib/partner-scope";

function displayRole(jobRole: "SALES_EXECUTIVE" | "TEAM_LEADER") {
  return jobRole === "TEAM_LEADER" ? "Team Leader" : "Sales Executive";
}

export const GET = withApiRoute("partner.team.list", async (req: Request) => {
  const { error, session } = await withPartnerAuth();
  if (error) return error;
  const cpError = await requireApprovedCP(session!);
  if (cpError) return cpError;

  const scope = getPartnerScope(session!);
  if (!scope.isOwner && scope.jobRole !== "TEAM_LEADER") {
    return apiError("Forbidden", 403);
  }

  const cpId = session!.user.cpId!;
  const url = new URL(req.url);
  const slim = url.searchParams.get("slim") === "1";
  const fromDate = url.searchParams.get("fromDate");
  const toDate = url.searchParams.get("toDate");
  const from = fromDate ? new Date(fromDate) : undefined;
  const to = toDate ? new Date(toDate) : undefined;
  if (to) to.setHours(23, 59, 59, 999);

  const members = await prisma.cPTeamMember.findMany({
    where: scope.isOwner
      ? { cpId }
      : {
          cpId,
          OR: [
            { id: scope.teamMemberId! },
            { teamLeaderId: scope.teamMemberId! },
          ],
        },
    ...(slim
      ? {}
      : {
          include: {
            teamLeader: { select: { id: true, name: true } },
            directReports: { select: { id: true, name: true, status: true } },
          },
        }),
    orderBy: [{ status: "asc" }, { jobRole: "asc" }, { name: "asc" }],
  });

  if (slim) {
    return apiResponse(
      members.map((member) => ({
        id: member.id,
        name: member.name,
        status: member.status,
        jobRole: member.jobRole,
        teamLeaderId: member.teamLeaderId,
        role: displayRole(member.jobRole),
      })),
    );
  }

  const fullMembers = members as Array<
    (typeof members)[number] & {
      teamLeader: { id: string; name: string } | null;
      directReports: Array<{ id: string; name: string; status: string }>;
    }
  >;

  const withPerformance = await Promise.all(
    fullMembers.map(async (member) => {
      const performance = await computeTeamMemberPerformance(cpId, member.id, from, to);
      let teamPerformance = null;
      if (member.jobRole === "TEAM_LEADER") {
        const reportIds = member.directReports
          .filter((r) => r.status === "ACTIVE")
          .map((r) => r.id);
        teamPerformance = await computeTeamRollup(
          cpId,
          [member.id, ...reportIds],
          from,
          to,
        );
      }
      return {
        ...member,
        performance,
        teamPerformance,
      };
    }),
  );

  const leaders = withPerformance.filter((m) => m.jobRole === "TEAM_LEADER");
  const unassignedExecutives = withPerformance.filter(
    (m) => m.jobRole === "SALES_EXECUTIVE" && !m.teamLeaderId,
  );

  return apiResponse({
    members: withPerformance,
    teams: leaders.map((leader) => ({
      leader,
      members: withPerformance.filter((m) => m.teamLeaderId === leader.id),
      performance: leader.teamPerformance,
    })),
    unassignedExecutives,
    canManage: scope.isOwner,
  });
});

export const POST = withApiRoute("partner.team.create", async (req: Request) => {
  const { error, session } = await withPartnerAuth();
  if (error) return error;
  const cpError = await requireApprovedCP(session!);
  if (cpError) return cpError;
  const ownerError = await requirePartnerOwner(session!);
  if (ownerError) return ownerError;

  const body = await req.json().catch(() => null);
  const parsed = cpTeamMemberCreateSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0].message);

  const cpId = session!.user.cpId!;
  const jobRole = parsed.data.jobRole || "SALES_EXECUTIVE";
  let teamLeaderId: string | null = null;

  if (jobRole === "SALES_EXECUTIVE" && parsed.data.teamLeaderId) {
    const leader = await prisma.cPTeamMember.findFirst({
      where: {
        id: parsed.data.teamLeaderId,
        cpId,
        jobRole: "TEAM_LEADER",
        status: "ACTIVE",
      },
      select: { id: true },
    });
    if (!leader) return apiError("Invalid team leader", 400);
    teamLeaderId = leader.id;
  }

  const member = await prisma.cPTeamMember.create({
    data: {
      cpId,
      name: parsed.data.name.trim(),
      email: parsed.data.email?.trim() || null,
      mobile: parsed.data.mobile?.trim() || null,
      jobRole,
      role: displayRole(jobRole),
      teamLeaderId: jobRole === "TEAM_LEADER" ? null : teamLeaderId,
    },
  });

  if (jobRole === "TEAM_LEADER" && parsed.data.memberIds?.length) {
    await prisma.cPTeamMember.updateMany({
      where: {
        cpId,
        id: { in: parsed.data.memberIds },
        jobRole: "SALES_EXECUTIVE",
      },
      data: { teamLeaderId: member.id },
    });
  }

  let invited = false;
  if (member.email) {
    try {
      const login = await syncTeamMemberLogin({
        cpId,
        teamMemberId: member.id,
        name: member.name,
        email: member.email,
      });
      invited = login.invited;
    } catch (e) {
      if (e instanceof TeamMemberAuthError) {
        await prisma.cPTeamMember.delete({ where: { id: member.id } });
        return apiError(e.message, 400);
      }
      throw e;
    }
  }

  return apiResponse({ ...member, invited }, 201);
});
