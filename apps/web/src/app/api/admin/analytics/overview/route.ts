import { prisma } from "@goyal/db";
import { withAuth, apiResponse } from "@/lib/api";
import { computeGrowth, getPeriodWindows, dateRangeFilter } from "@/lib/analytics/growth";
import { resolveProjectBannerUrl } from "@/lib/project-banner";

export async function GET() {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;

  const { currentStart, currentEnd, previousStart, previousEnd } = getPeriodWindows();
  const currentRange = dateRangeFilter(currentStart, currentEnd);
  const previousRange = dateRangeFilter(previousStart, previousEnd);

  const [
    totalCPs,
    pendingCPs,
    totalLeads,
    totalEOIs,
    approvedEOIs,
    rejectedEOIs,
    submittedEOIs,
    draftEOIs,
    confirmationPending,
    chequeUploaded,
    chequeMissing,
    currentApprovedCPs,
    previousApprovedCPs,
    currentPendingCPs,
    previousPendingCPs,
    currentLeads,
    previousLeads,
    currentEOIs,
    previousEOIs,
    currentApprovedEOIs,
    previousApprovedEOIs,
    currentRejectedEOIs,
    previousRejectedEOIs,
    currentSubmittedEOIs,
    previousSubmittedEOIs,
    currentDraftLeads,
    previousDraftLeads,
    currentConfirmationPending,
    previousConfirmationPending,
    currentChequeUploaded,
    previousChequeUploaded,
    currentChequeMissing,
    previousChequeMissing,
    leadOnlyTotal,
    leadOnlyPending,
    leadOnlyConfirmed,
    currentLeadOnlyTotal,
    previousLeadOnlyTotal,
    currentLeadOnlyPending,
    previousLeadOnlyPending,
    currentLeadOnlyConfirmed,
    previousLeadOnlyConfirmed,
    eoiLeadsTotal,
  ] = await Promise.all([
    prisma.channelPartner.count({ where: { status: "APPROVED" } }),
    prisma.channelPartner.count({ where: { status: "PENDING" } }),
    prisma.lead.count(),
    prisma.eOI.count({ where: { status: { not: "PENDING_SUBMISSION" } } }),
    prisma.eOI.count({ where: { status: "APPROVED" } }),
    prisma.eOI.count({ where: { status: "REJECTED" } }),
    prisma.eOI.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } }),
    prisma.lead.count({ where: { journeyStatus: "DRAFT" } }),
    prisma.lead.count({ where: { journeyStatus: "CONFIRMATION_PENDING" } }),
    prisma.eOI.count({ where: { chequeUploaded: true } }),
    prisma.eOI.count({ where: { status: "SUBMITTED", chequeUploaded: false } }),
    prisma.channelPartner.count({ where: { status: "APPROVED", createdAt: currentRange } }),
    prisma.channelPartner.count({ where: { status: "APPROVED", createdAt: previousRange } }),
    prisma.channelPartner.count({ where: { status: "PENDING", createdAt: currentRange } }),
    prisma.channelPartner.count({ where: { status: "PENDING", createdAt: previousRange } }),
    prisma.lead.count({ where: { createdAt: currentRange } }),
    prisma.lead.count({ where: { createdAt: previousRange } }),
    prisma.eOI.count({ where: { status: { not: "PENDING_SUBMISSION" }, submittedAt: currentRange } }),
    prisma.eOI.count({ where: { status: { not: "PENDING_SUBMISSION" }, submittedAt: previousRange } }),
    prisma.eOI.count({ where: { status: "APPROVED", updatedAt: currentRange } }),
    prisma.eOI.count({ where: { status: "APPROVED", updatedAt: previousRange } }),
    prisma.eOI.count({ where: { status: "REJECTED", updatedAt: currentRange } }),
    prisma.eOI.count({ where: { status: "REJECTED", updatedAt: previousRange } }),
    prisma.eOI.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] }, submittedAt: currentRange } }),
    prisma.eOI.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] }, submittedAt: previousRange } }),
    prisma.lead.count({ where: { journeyStatus: "DRAFT", createdAt: currentRange } }),
    prisma.lead.count({ where: { journeyStatus: "DRAFT", createdAt: previousRange } }),
    prisma.lead.count({ where: { journeyStatus: "CONFIRMATION_PENDING", createdAt: currentRange } }),
    prisma.lead.count({ where: { journeyStatus: "CONFIRMATION_PENDING", createdAt: previousRange } }),
    prisma.eOI.count({ where: { chequeUploaded: true, updatedAt: currentRange } }),
    prisma.eOI.count({ where: { chequeUploaded: true, updatedAt: previousRange } }),
    prisma.eOI.count({ where: { status: "SUBMITTED", chequeUploaded: false, submittedAt: currentRange } }),
    prisma.eOI.count({ where: { status: "SUBMITTED", chequeUploaded: false, submittedAt: previousRange } }),
    prisma.lead.count({ where: { intentType: "LEAD_ONLY" } }),
    prisma.lead.count({ where: { intentType: "LEAD_ONLY", journeyStatus: "CONFIRMATION_PENDING" } }),
    prisma.lead.count({ where: { intentType: "LEAD_ONLY", journeyStatus: "LEAD_CONFIRMED" } }),
    prisma.lead.count({ where: { intentType: "LEAD_ONLY", createdAt: currentRange } }),
    prisma.lead.count({ where: { intentType: "LEAD_ONLY", createdAt: previousRange } }),
    prisma.lead.count({ where: { intentType: "LEAD_ONLY", journeyStatus: "CONFIRMATION_PENDING", createdAt: currentRange } }),
    prisma.lead.count({ where: { intentType: "LEAD_ONLY", journeyStatus: "CONFIRMATION_PENDING", createdAt: previousRange } }),
    prisma.lead.count({ where: { intentType: "LEAD_ONLY", journeyStatus: "LEAD_CONFIRMED", createdAt: currentRange } }),
    prisma.lead.count({ where: { intentType: "LEAD_ONLY", journeyStatus: "LEAD_CONFIRMED", createdAt: previousRange } }),
    prisma.lead.count({ where: { intentType: "EOI" } }),
  ]);

  const pendingApprovals = submittedEOIs;

  const projects = await prisma.project.findMany({
    where: { status: "ACTIVE" },
    include: {
      _count: { select: { leads: true, eois: true } },
      leads: { select: { intentType: true } },
      eois: { where: { status: { in: ["APPROVED", "CLOSED"] } }, select: { id: true } },
    },
    take: 6,
  });

  const eoisByCP = await prisma.channelPartner.findMany({
    where: { status: "APPROVED" },
    include: {
      user: { select: { name: true } },
      _count: { select: { leads: true, eois: true } },
      eois: { where: { status: "APPROVED" }, select: { id: true } },
    },
    take: 10,
  });

  const journeyBreakdown = await prisma.lead.groupBy({
    by: ["journeyStatus"],
    _count: { id: true },
  });

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const recentSubmissions = await prisma.eOI.findMany({
    where: {
      submittedAt: { gte: sevenDaysAgo },
      status: { not: "PENDING_SUBMISSION" },
    },
    select: { submittedAt: true },
  });

  const eoiTrend = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(sevenDaysAgo);
    date.setDate(date.getDate() + i);
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    const count = recentSubmissions.filter(
      (e) => e.submittedAt && e.submittedAt >= dayStart && e.submittedAt <= dayEnd
    ).length;
    return {
      name: date.toLocaleDateString("en-IN", { weekday: "short" }),
      value: count,
    };
  });

  const projectPerformance = await Promise.all(
    projects.map(async (p) => {
      const leadOnlyCount = p.leads.filter((l) => l.intentType === "LEAD_ONLY").length;
      const eoiLeadCount = p.leads.filter((l) => l.intentType === "EOI").length;
      return {
        id: p.id,
        name: p.name,
        location: p.location,
        eoiStatus: p.eoiStatus,
        bannerUrl: await resolveProjectBannerUrl(p.bannerUrl),
        totalLeads: p._count.leads,
        totalEois: p._count.eois,
        leadOnlyCount,
        eoiLeadCount,
        totalClosures: p.eois.length,
        conversionRate: p._count.leads > 0 ? Math.round((p.eois.length / p._count.leads) * 100) : 0,
      };
    })
  );

  return apiResponse({
    stats: {
      totalCPs: { value: totalCPs, growth: computeGrowth(currentApprovedCPs, previousApprovedCPs) },
      pendingCPs: { value: pendingCPs, growth: computeGrowth(currentPendingCPs, previousPendingCPs) },
      totalLeads: { value: totalLeads, growth: computeGrowth(currentLeads, previousLeads) },
      totalEOIs: { value: totalEOIs, growth: computeGrowth(currentEOIs, previousEOIs) },
      approvedEOIs: { value: approvedEOIs, growth: computeGrowth(currentApprovedEOIs, previousApprovedEOIs) },
      rejectedEOIs: { value: rejectedEOIs, growth: computeGrowth(currentRejectedEOIs, previousRejectedEOIs) },
      submittedEOIs: { value: submittedEOIs, growth: computeGrowth(currentSubmittedEOIs, previousSubmittedEOIs) },
      draftEOIs: { value: draftEOIs, growth: computeGrowth(currentDraftLeads, previousDraftLeads) },
      confirmationPending: { value: confirmationPending, growth: computeGrowth(currentConfirmationPending, previousConfirmationPending) },
      chequeUploaded: { value: chequeUploaded, growth: computeGrowth(currentChequeUploaded, previousChequeUploaded) },
      chequeMissing: { value: chequeMissing, growth: computeGrowth(currentChequeMissing, previousChequeMissing) },
      closures: { value: approvedEOIs, growth: computeGrowth(currentApprovedEOIs, previousApprovedEOIs) },
      leadOnlyTotal: { value: leadOnlyTotal, growth: computeGrowth(currentLeadOnlyTotal, previousLeadOnlyTotal) },
      leadOnlyPending: { value: leadOnlyPending, growth: computeGrowth(currentLeadOnlyPending, previousLeadOnlyPending) },
      leadOnlyConfirmed: { value: leadOnlyConfirmed, growth: computeGrowth(currentLeadOnlyConfirmed, previousLeadOnlyConfirmed) },
      eoiLeadsTotal: { value: eoiLeadsTotal, growth: 0 },
    },
    pendingApprovals,
    projectPerformance,
    charts: {
      eoiTrend,
      leadDistribution: projects.map((p) => ({ name: p.name, value: p._count.leads })),
      approvalRatio: [
        { name: "Approved", value: approvedEOIs },
        { name: "Rejected", value: rejectedEOIs },
        { name: "Pending", value: pendingApprovals },
      ],
      journeyBreakdown: journeyBreakdown.map((j) => ({ name: j.journeyStatus, value: j._count.id })),
      leadIntentBreakdown: [
        { name: "EOI Leads", value: eoiLeadsTotal },
        { name: "Lead Only", value: leadOnlyTotal },
      ],
      eoisByCP: eoisByCP.map((cp) => ({
        name: cp.user.name || "CP",
        value: cp._count.eois,
        approved: cp.eois.length,
        leads: cp._count.leads,
      })),
    },
  });
}
