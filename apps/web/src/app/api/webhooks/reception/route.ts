import { prisma } from "@goyal/db";
import { apiResponse, apiError } from "@/lib/api";
import { normalizeMobile } from "@/lib/leads/phone";
import { writeAudit, getIpFromRequest } from "@/lib/services/audit";

/**
 * Reception / Booking Inventory → EOI Partner Portal webhook.
 *
 * Auth (any one):
 *   Authorization: Bearer <INTEGRATION_WEBHOOK_SECRET>
 *   X-Integration-Secret: <INTEGRATION_WEBHOOK_SECRET>
 *
 * Body:
 *   { "event"|"type": "site_visit.completed"|"booking.confirmed",
 *     "leadId"|"publicLeadId": "EOI-…",
 *     "eoiCpLeadId"|"internalLeadId": "<uuid>",
 *     "phone"|"mobile"|"customerMobile": "9876543210" }
 *
 * Prefer public leadId; then internal id; phone is last-resort fallback.
 */
export async function POST(req: Request) {
  const secret = process.env.INTEGRATION_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return apiError("INTEGRATION_WEBHOOK_SECRET is not configured", 500);
  }

  const auth = req.headers.get("authorization") || "";
  const headerSecret = req.headers.get("x-integration-secret") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (bearer !== secret && headerSecret !== secret) {
    return apiError("Unauthorized", 401);
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return apiError("Invalid JSON body");

  const raw = body as Record<string, unknown>;
  const event = String(raw.event || raw.type || "").toLowerCase().trim();
  const phoneRaw = String(
    raw.phone || raw.mobile || raw.customerMobile || raw.customerPhone || "",
  );
  const publicLeadId =
    String(raw.leadId || raw.publicLeadId || "").trim() || null;
  const internalLeadId =
    String(raw.eoiCpLeadId || raw.internalLeadId || raw.cpLeadId || "").trim() ||
    null;
  const mobile = phoneRaw ? normalizeMobile(phoneRaw) : "";

  if (!mobile && !publicLeadId && !internalLeadId) {
    return apiError("phone, leadId, or eoiCpLeadId is required");
  }

  let leads =
    publicLeadId
      ? await prisma.lead.findMany({
          where: { leadId: publicLeadId, journeyStatus: { not: "REJECTED" } },
        })
      : [];

  // Booking stores EOI's public id in LeadRegistry.leadId and EOI DB uuid in eoiCpLeadId.
  // If the caller sent the uuid as leadId, resolve by primary key.
  if (leads.length === 0 && publicLeadId && looksLikeUuid(publicLeadId)) {
    leads = await prisma.lead.findMany({
      where: { id: publicLeadId, journeyStatus: { not: "REJECTED" } },
    });
  }

  if (leads.length === 0 && internalLeadId) {
    leads = await prisma.lead.findMany({
      where: {
        journeyStatus: { not: "REJECTED" },
        ...(looksLikeUuid(internalLeadId)
          ? { id: internalLeadId }
          : { leadId: internalLeadId }),
      },
    });
  }

  if (leads.length === 0 && mobile) {
    leads = await prisma.lead.findMany({
      where: {
        journeyStatus: { not: "REJECTED" },
        OR: [
          { customerMobile: mobile },
          { customerMobile: { endsWith: mobile } },
        ],
      },
    });
  }

  if (leads.length === 0) {
    return apiError("Lead not found", 404);
  }

  const ids = leads.map((l) => l.id);

  if (
    event === "site_visit.completed" ||
    event === "lead.site_visit" ||
    event === "site_visit" ||
    event === "sitevisit.completed"
  ) {
    await prisma.lead.updateMany({
      where: { id: { in: ids } },
      data: { siteVisitStatus: "COMPLETED" },
    });

    await writeAudit({
      action: "SITE_VISIT_COMPLETED_RECEPTION",
      entityType: "Lead",
      entityId: leads[0].id,
      metadata: {
        event,
        phone: mobile || undefined,
        leadId: publicLeadId,
        eoiCpLeadId: internalLeadId,
        count: leads.length,
      },
      ipAddress: getIpFromRequest(req),
    });

    return apiResponse({
      success: true,
      updated: leads.length,
      event: "site_visit.completed",
    });
  }

  if (
    event === "booking.confirmed" ||
    event === "booking.booked" ||
    event === "lead.booked" ||
    event === "booking.confirm"
  ) {
    await prisma.lead.updateMany({
      where: { id: { in: ids } },
      data: {
        leadStatus: "BOOKED",
        journeyStatus: "BOOKED",
        siteVisitStatus: "COMPLETED",
      },
    });

    await writeAudit({
      action: "LEAD_BOOKED_RECEPTION",
      entityType: "Lead",
      entityId: leads[0].id,
      metadata: {
        event,
        phone: mobile || undefined,
        leadId: publicLeadId,
        eoiCpLeadId: internalLeadId,
        count: leads.length,
      },
      ipAddress: getIpFromRequest(req),
    });

    return apiResponse({
      success: true,
      updated: leads.length,
      event: "booking.confirmed",
    });
  }

  return apiError(`Unsupported event: ${event || "(empty)"}`);
}

function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
