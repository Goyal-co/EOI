import { prisma } from "@goyal/db";
import { withAuth, apiResponse, apiError, requireApprovedCP } from "@/lib/api";
import { computeGrowth, getPeriodWindows, dateRangeFilter } from "@/lib/analytics/growth";
import { getSystemSettings } from "@/lib/services/system-settings";

export async function GET() {
  const { error, session } = await withAuth(["CHANNEL_PARTNER"]);
  if (error) return error;
  const cpError = await requireApprovedCP(session!);
  if (cpError) return cpError;

  const settings = await getSystemSettings();
  if (!settings.permissions.cpCanViewAnalytics) {
    return apiError("Analytics access is disabled for channel partners", 403);
  }

  const cpId = session!.user.cpId!;
  const { currentStart, currentEnd, previousStart, previousEnd } = getPeriodWindows();
  const currentRange = dateRangeFilter(currentStart, currentEnd);
  const previousRange = dateRangeFilter(previousStart, previousEnd);
  const cpFilter = { cpId };

  const [
    leads,
    totalLeads,
    currentTotalLeads,
    previousTotalLeads,
    currentConfirmationPending,
    previousConfirmationPending,
    currentConfirmationSent,
    previousConfirmationSent,
    currentDraft,
    previousDraft,
    currentSubmitted,
    previousSubmitted,
    currentApproved,
    previousApproved,
    currentRejected,
    previousRejected,
    currentActive,
    previousActive,
    totalProjects,
    currentProjects,
    previousProjects,
    leadOnlyTotal,
    currentLeadOnlyTotal,
    previousLeadOnlyTotal,
    leadOnlyPending,
    currentLeadOnlyPending,
    previousLeadOnlyPending,
    leadOnlyConfirmed,
    currentLeadOnlyConfirmed,
    previousLeadOnlyConfirmed,
    eoiLeadsTotal,
    currentEoiLeadsTotal,
    previousEoiLeadsTotal,
  ] = await Promise.all([
    prisma.lead.findMany({
      where: cpFilter,
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        customerName: true,
        journeyStatus: true,
        confirmationSentAt: true,
      },
    }),
    prisma.lead.count({ where: cpFilter }),
    prisma.lead.count({ where: { ...cpFilter, createdAt: currentRange } }),
    prisma.lead.count({ where: { ...cpFilter, createdAt: previousRange } }),
    prisma.lead.count({ where: { ...cpFilter, journeyStatus: "CONFIRMATION_PENDING", createdAt: currentRange } }),
    prisma.lead.count({ where: { ...cpFilter, journeyStatus: "CONFIRMATION_PENDING", createdAt: previousRange } }),
    prisma.lead.count({ where: { ...cpFilter, confirmationSentAt: currentRange } }),
    prisma.lead.count({ where: { ...cpFilter, confirmationSentAt: previousRange } }),
    prisma.lead.count({ where: { ...cpFilter, journeyStatus: "DRAFT", createdAt: currentRange } }),
    prisma.lead.count({ where: { ...cpFilter, journeyStatus: "DRAFT", createdAt: previousRange } }),
    prisma.lead.count({ where: { ...cpFilter, journeyStatus: "SUBMITTED", createdAt: currentRange } }),
    prisma.lead.count({ where: { ...cpFilter, journeyStatus: "SUBMITTED", createdAt: previousRange } }),
    prisma.lead.count({ where: { ...cpFilter, journeyStatus: "APPROVED", createdAt: currentRange } }),
    prisma.lead.count({ where: { ...cpFilter, journeyStatus: "APPROVED", createdAt: previousRange } }),
    prisma.lead.count({ where: { ...cpFilter, journeyStatus: "REJECTED", createdAt: currentRange } }),
    prisma.lead.count({ where: { ...cpFilter, journeyStatus: "REJECTED", createdAt: previousRange } }),
    prisma.lead.count({ where: { ...cpFilter, journeyStatus: "ACTIVE", createdAt: currentRange } }),
    prisma.lead.count({ where: { ...cpFilter, journeyStatus: "ACTIVE", createdAt: previousRange } }),
    prisma.cPProjectAccess.count({ where: cpFilter }),
    prisma.cPProjectAccess.count({ where: { ...cpFilter, createdAt: currentRange } }),
    prisma.cPProjectAccess.count({ where: { ...cpFilter, createdAt: previousRange } }),
    prisma.lead.count({ where: { ...cpFilter, intentType: "LEAD_ONLY" } }),
    prisma.lead.count({ where: { ...cpFilter, intentType: "LEAD_ONLY", createdAt: currentRange } }),
    prisma.lead.count({ where: { ...cpFilter, intentType: "LEAD_ONLY", createdAt: previousRange } }),
    prisma.lead.count({ where: { ...cpFilter, intentType: "LEAD_ONLY", journeyStatus: "CONFIRMATION_PENDING" } }),
    prisma.lead.count({ where: { ...cpFilter, intentType: "LEAD_ONLY", journeyStatus: "CONFIRMATION_PENDING", createdAt: currentRange } }),
    prisma.lead.count({ where: { ...cpFilter, intentType: "LEAD_ONLY", journeyStatus: "CONFIRMATION_PENDING", createdAt: previousRange } }),
    prisma.lead.count({ where: { ...cpFilter, intentType: "LEAD_ONLY", journeyStatus: "LEAD_CONFIRMED" } }),
    prisma.lead.count({ where: { ...cpFilter, intentType: "LEAD_ONLY", journeyStatus: "LEAD_CONFIRMED", createdAt: currentRange } }),
    prisma.lead.count({ where: { ...cpFilter, intentType: "LEAD_ONLY", journeyStatus: "LEAD_CONFIRMED", createdAt: previousRange } }),
    prisma.lead.count({ where: { ...cpFilter, intentType: "EOI" } }),
    prisma.lead.count({ where: { ...cpFilter, intentType: "EOI", createdAt: currentRange } }),
    prisma.lead.count({ where: { ...cpFilter, intentType: "EOI", createdAt: previousRange } }),
  ]);

  const allLeads = await prisma.lead.findMany({ where: cpFilter, select: { journeyStatus: true, confirmationSentAt: true } });
  const journeyCounts = allLeads.reduce((acc, l) => {
    acc[l.journeyStatus] = (acc[l.journeyStatus] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return apiResponse({
    totalLeads: { value: totalLeads, growth: computeGrowth(currentTotalLeads, previousTotalLeads) },
    confirmationPending: {
      value: journeyCounts.CONFIRMATION_PENDING || 0,
      growth: computeGrowth(currentConfirmationPending, previousConfirmationPending),
    },
    confirmationSent: {
      value: allLeads.filter((l) => l.confirmationSentAt).length,
      growth: computeGrowth(currentConfirmationSent, previousConfirmationSent),
    },
    draft: { value: journeyCounts.DRAFT || 0, growth: computeGrowth(currentDraft, previousDraft) },
    submittedEOIs: { value: journeyCounts.SUBMITTED || 0, growth: computeGrowth(currentSubmitted, previousSubmitted) },
    approvedEOIs: { value: journeyCounts.APPROVED || 0, growth: computeGrowth(currentApproved, previousApproved) },
    rejectedEOIs: { value: journeyCounts.REJECTED || 0, growth: computeGrowth(currentRejected, previousRejected) },
    activeLeads: { value: journeyCounts.ACTIVE || 0, growth: computeGrowth(currentActive, previousActive) },
    leadOnlyTotal: { value: leadOnlyTotal, growth: computeGrowth(currentLeadOnlyTotal, previousLeadOnlyTotal) },
    leadOnlyPending: { value: leadOnlyPending, growth: computeGrowth(currentLeadOnlyPending, previousLeadOnlyPending) },
    leadOnlyConfirmed: { value: leadOnlyConfirmed, growth: computeGrowth(currentLeadOnlyConfirmed, previousLeadOnlyConfirmed) },
    eoiLeadsTotal: { value: eoiLeadsTotal, growth: computeGrowth(currentEoiLeadsTotal, previousEoiLeadsTotal) },
    totalProjects: { value: totalProjects, growth: computeGrowth(currentProjects, previousProjects) },
    journeyCounts,
    recentLeads: leads,
  });
}
