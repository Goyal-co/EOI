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
  const eoiFilter = { cpId };

  const [
    leads,
    totalLeads,
    currentTotalLeads,
    previousTotalLeads,
    currentConfirmationPending,
    previousConfirmationPending,
    currentDraftLeads,
    previousDraftLeads,
    currentCorrectionPending,
    previousCorrectionPending,
    submittedEOIs,
    currentSubmittedEOIs,
    previousSubmittedEOIs,
    approvedEOIs,
    currentApprovedEOIs,
    previousApprovedEOIs,
    rejectedEOIs,
    currentRejectedEOIs,
    previousRejectedEOIs,
    eoiPendingCustomer,
    currentEoiPendingCustomer,
    previousEoiPendingCustomer,
    confirmationPending,
    currentEoiConfirmationPending,
    previousEoiConfirmationPending,
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
    prisma.lead.count({ where: { ...cpFilter, journeyStatus: "DRAFT", createdAt: currentRange } }),
    prisma.lead.count({ where: { ...cpFilter, journeyStatus: "DRAFT", createdAt: previousRange } }),
    prisma.lead.count({ where: { ...cpFilter, journeyStatus: "CORRECTION_PENDING", createdAt: currentRange } }),
    prisma.lead.count({ where: { ...cpFilter, journeyStatus: "CORRECTION_PENDING", createdAt: previousRange } }),
    prisma.eOI.count({
      where: { ...eoiFilter, status: { in: ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "CLOSED"] } },
    }),
    prisma.eOI.count({
      where: { ...eoiFilter, submittedAt: currentRange, status: { notIn: ["PENDING_SUBMISSION", "DRAFT"] } },
    }),
    prisma.eOI.count({
      where: { ...eoiFilter, submittedAt: previousRange, status: { notIn: ["PENDING_SUBMISSION", "DRAFT"] } },
    }),
    prisma.eOI.count({ where: { ...eoiFilter, status: "APPROVED" } }),
    prisma.eOI.count({ where: { ...eoiFilter, status: "APPROVED", approvedAt: currentRange } }),
    prisma.eOI.count({ where: { ...eoiFilter, status: "APPROVED", approvedAt: previousRange } }),
    prisma.eOI.count({ where: { ...eoiFilter, status: "REJECTED" } }),
    prisma.eOI.count({ where: { ...eoiFilter, status: "REJECTED", updatedAt: currentRange } }),
    prisma.eOI.count({ where: { ...eoiFilter, status: "REJECTED", updatedAt: previousRange } }),
    prisma.eOI.count({
      where: {
        ...eoiFilter,
        status: { in: ["DRAFT", "PENDING_SUBMISSION", "CORRECTION_REQUESTED"] },
      },
    }),
    prisma.eOI.count({
      where: {
        ...eoiFilter,
        status: { in: ["DRAFT", "PENDING_SUBMISSION", "CORRECTION_REQUESTED"] },
        updatedAt: currentRange,
      },
    }),
    prisma.eOI.count({
      where: {
        ...eoiFilter,
        status: { in: ["DRAFT", "PENDING_SUBMISSION", "CORRECTION_REQUESTED"] },
        updatedAt: previousRange,
      },
    }),
    prisma.lead.count({
      where: { ...cpFilter, intentType: "EOI", journeyStatus: "CONFIRMATION_PENDING" },
    }),
    prisma.lead.count({
      where: { ...cpFilter, intentType: "EOI", journeyStatus: "CONFIRMATION_PENDING", createdAt: currentRange },
    }),
    prisma.lead.count({
      where: { ...cpFilter, intentType: "EOI", journeyStatus: "CONFIRMATION_PENDING", createdAt: previousRange },
    }),
  ]);

  const journeyCounts = await prisma.lead.groupBy({
    by: ["journeyStatus"],
    where: cpFilter,
    _count: { _all: true },
  });
  const journeyMap = Object.fromEntries(
    journeyCounts.map((row) => [row.journeyStatus, row._count._all])
  );

  return apiResponse({
    totalLeads: { value: totalLeads, growth: computeGrowth(currentTotalLeads, previousTotalLeads) },
    eoiPendingCustomer: {
      value: eoiPendingCustomer,
      growth: computeGrowth(currentEoiPendingCustomer, previousEoiPendingCustomer),
    },
    confirmationPending: {
      value: confirmationPending,
      growth: computeGrowth(currentEoiConfirmationPending, previousEoiConfirmationPending),
    },
    submittedEOIs: {
      value: submittedEOIs,
      growth: computeGrowth(currentSubmittedEOIs, previousSubmittedEOIs),
    },
    approvedEOIs: {
      value: approvedEOIs,
      growth: computeGrowth(currentApprovedEOIs, previousApprovedEOIs),
    },
    rejectedEOIs: {
      value: rejectedEOIs,
      growth: computeGrowth(currentRejectedEOIs, previousRejectedEOIs),
    },
    draft: {
      value: journeyMap.DRAFT || 0,
      growth: computeGrowth(currentDraftLeads, previousDraftLeads),
    },
    correctionPending: {
      value: journeyMap.CORRECTION_PENDING || 0,
      growth: computeGrowth(currentCorrectionPending, previousCorrectionPending),
    },
    journeyCounts: journeyMap,
    recentLeads: leads,
  });
}
