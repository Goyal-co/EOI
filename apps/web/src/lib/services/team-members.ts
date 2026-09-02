import { prisma } from "@goyal/db";

export async function computeTeamMemberPerformance(
  cpId: string,
  teamMemberId: string,
  fromDate?: Date,
  toDate?: Date,
) {
  const createdAt: { gte?: Date; lte?: Date } = {};
  if (fromDate) createdAt.gte = fromDate;
  if (toDate) createdAt.lte = toDate;

  const baseWhere = {
    cpId,
    teamMemberId,
    ...(Object.keys(createdAt).length ? { createdAt } : {}),
  };

  const [totalLeads, siteVisitsCompleted, booked, eoiSubmitted, eoiApproved] = await Promise.all([
    prisma.lead.count({ where: baseWhere }),
    prisma.lead.count({
      where: { ...baseWhere, siteVisitStatus: "COMPLETED" },
    }),
    prisma.lead.count({
      where: { ...baseWhere, journeyStatus: "BOOKED" },
    }),
    prisma.eOI.count({
      where: {
        cpId,
        lead: { teamMemberId, ...(Object.keys(createdAt).length ? { createdAt } : {}) },
        status: { in: ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "CLOSED"] },
      },
    }),
    prisma.eOI.count({
      where: {
        cpId,
        lead: { teamMemberId, ...(Object.keys(createdAt).length ? { createdAt } : {}) },
        status: "APPROVED",
      },
    }),
  ]);

  const conversionRate = totalLeads > 0 ? Math.round((booked / totalLeads) * 100) : 0;

  return {
    totalLeads,
    siteVisitsCompleted,
    booked,
    eoiSubmitted,
    eoiApproved,
    conversionRate,
  };
}

export async function computeTeamRollup(
  cpId: string,
  memberIds: string[],
  fromDate?: Date,
  toDate?: Date,
) {
  if (!memberIds.length) {
    return {
      totalLeads: 0,
      siteVisitsCompleted: 0,
      booked: 0,
      eoiSubmitted: 0,
      eoiApproved: 0,
      conversionRate: 0,
    };
  }
  const createdAt: { gte?: Date; lte?: Date } = {};
  if (fromDate) createdAt.gte = fromDate;
  if (toDate) createdAt.lte = toDate;
  const baseWhere = {
    cpId,
    teamMemberId: { in: memberIds },
    ...(Object.keys(createdAt).length ? { createdAt } : {}),
  };
  const [totalLeads, siteVisitsCompleted, booked, eoiSubmitted, eoiApproved] = await Promise.all([
    prisma.lead.count({ where: baseWhere }),
    prisma.lead.count({ where: { ...baseWhere, siteVisitStatus: "COMPLETED" } }),
    prisma.lead.count({ where: { ...baseWhere, journeyStatus: "BOOKED" } }),
    prisma.eOI.count({
      where: {
        cpId,
        lead: { teamMemberId: { in: memberIds }, ...(Object.keys(createdAt).length ? { createdAt } : {}) },
        status: { in: ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "CLOSED"] },
      },
    }),
    prisma.eOI.count({
      where: {
        cpId,
        lead: { teamMemberId: { in: memberIds }, ...(Object.keys(createdAt).length ? { createdAt } : {}) },
        status: "APPROVED",
      },
    }),
  ]);
  return {
    totalLeads,
    siteVisitsCompleted,
    booked,
    eoiSubmitted,
    eoiApproved,
    conversionRate: totalLeads > 0 ? Math.round((booked / totalLeads) * 100) : 0,
  };
}

export async function resolveTeamMemberForLead(
  cpId: string,
  teamMemberId?: string | null,
  fosName?: string | null,
): Promise<{ teamMemberId: string | null; fosName: string | null }> {
  if (teamMemberId) {
    const member = await prisma.cPTeamMember.findFirst({
      where: { id: teamMemberId, cpId, status: "ACTIVE" },
      select: { id: true, name: true },
    });
    if (!member) {
      throw new Error("Invalid team member");
    }
    return { teamMemberId: member.id, fosName: member.name };
  }
  const trimmed = (fosName || "").trim();
  if (trimmed) {
    return { teamMemberId: null, fosName: trimmed };
  }
  return { teamMemberId: null, fosName: null };
}
