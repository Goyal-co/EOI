import { prisma } from "@goyal/db";
import { withAuth, apiResponse, apiError, withApiRoute } from "@/lib/api";

async function fetchBookingStatus(leadId: string) {
  const hubUrl = process.env.BOOKING_INVENTORY_URL ?? process.env.INTEGRATION_HUB_URL;
  if (!hubUrl) return null;

  const res = await fetch(`${hubUrl}/api/integration/leads/${encodeURIComponent(leadId)}/status`, {
    headers: {
      "x-integration-secret": process.env.INTEGRATION_WEBHOOK_SECRET ?? "",
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

export const GET = withApiRoute("partner.leads.id.booking-status.get", async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { error, session } = await withAuth(["CHANNEL_PARTNER", "ADMIN"]);
  if (error) return error;

  const { id } = await params;
  const lead = await prisma.lead.findFirst({
    where: session!.user.role === "ADMIN" ? { id } : { id, cpId: session!.user.cpId! },
    select: {
      id: true,
      leadId: true,
      titanCrmId: true,
      bookingLeadId: true,
      customerName: true,
      customerEmail: true,
      customerMobile: true,
      leadStatus: true,
      journeyStatus: true,
      createdAt: true,
      project: { select: { name: true } },
      eoi: { select: { status: true, referenceNumber: true } },
    },
  });

  if (!lead) return apiError("Lead not found", 404);

  const publicLeadId = lead.bookingLeadId ?? lead.leadId;
  const bookingData = publicLeadId ? await fetchBookingStatus(publicLeadId) : null;

  const timeline = [
    { event: "LEAD_CREATED", at: lead.createdAt.toISOString() },
    ...(lead.eoi
      ? [{ event: "EOI_LINKED" as const, at: lead.createdAt.toISOString(), status: lead.eoi.status }]
      : []),
    ...(bookingData?.timeline ?? []),
  ];

  return apiResponse({
    lead,
    bookingStatus: bookingData ?? {
      linked: Boolean(publicLeadId),
      bookingLeadId: publicLeadId,
    },
    timeline,
  });
});
