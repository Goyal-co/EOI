import { prisma } from "@goyal/db";
import { apiResponse, apiError } from "@/lib/api";
import { normalizeMobile } from "@/lib/leads/phone";
import { writeAudit, getIpFromRequest } from "@/lib/services/audit";
import { NotificationService } from "@goyal/email";
import { recordLeadEvent } from "@/lib/leads/identity";

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
 *     "cpId": "<channel partner id>",
 *     "phone"|"mobile"|"customerMobile": "9876543210" }
 *
 * When cpId is provided, only that CP's association is updated/notified.
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
  const event = normalizeWebhookEvent(
    raw.event
      || raw.type
      || (raw.siteVisitStatus ? `site_visit.${String(raw.siteVisitStatus)}` : "")
      || raw.leadStatus
      || raw.status
      || "",
  );
  const phoneRaw = String(
    raw.phone || raw.mobile || raw.customerMobile || raw.customerPhone || "",
  );
  const publicLeadId =
    String(raw.leadId || raw.publicLeadId || "").trim() || null;
  const internalLeadId =
    String(raw.eoiCpLeadId || raw.internalLeadId || raw.cpLeadId || "").trim() ||
    null;
  const crmLeadId =
    String(raw.titanCrmId || raw.crmLeadId || raw.externalLeadId || "").trim() ||
    null;
  const cpId = String(raw.cpId || "").trim() || null;
  const projectId = String(raw.projectId || "").trim() || null;
  const projectName = String(raw.projectName || "").trim() || null;
  const salesperson =
    String(raw.salespersonName || raw.salesperson || raw.salespersonId || "").trim() ||
    null;
  const mobile = phoneRaw ? normalizeMobile(phoneRaw) : "";

  if (!mobile && !publicLeadId && !internalLeadId && !crmLeadId) {
    return apiError("phone, leadId, eoiCpLeadId, or crmLeadId is required");
  }

  const include = {
    project: { select: { id: true, name: true } },
    cp: { include: { user: { select: { id: true, name: true, email: true } } } },
    customer: {
      include: { user: { select: { id: true, name: true, email: true } } },
    },
    identity: { select: { id: true } },
  } as const;

  let matchedByExactId = false;
  let leads = internalLeadId
    ? await prisma.lead.findMany({
        where: { id: internalLeadId, journeyStatus: { not: "REJECTED" } },
        include,
      })
    : [];
  matchedByExactId = leads.length > 0;

  // Some integrations historically placed EOI_CP's internal CUID in leadId.
  if (leads.length === 0 && publicLeadId) {
    leads = await prisma.lead.findMany({
      where: { id: publicLeadId, journeyStatus: { not: "REJECTED" } },
      include,
    });
    matchedByExactId = leads.length > 0;
  }

  if (leads.length === 0 && internalLeadId) {
    leads = await prisma.lead.findMany({
      where: {
        journeyStatus: { not: "REJECTED" },
        leadId: internalLeadId,
      },
      include,
    });
  }

  if (leads.length === 0 && crmLeadId) {
    leads = await prisma.lead.findMany({
      where: {
        titanCrmId: crmLeadId,
        journeyStatus: { not: "REJECTED" },
        ...(cpId ? { cpId } : {}),
        ...(projectId ? { projectId } : {}),
        ...(projectName
          ? { project: { name: { equals: projectName, mode: "insensitive" } } }
          : {}),
      },
      include,
    });
    matchedByExactId = leads.length === 1;
  }

  if (leads.length === 0 && publicLeadId) {
    leads = await prisma.lead.findMany({
      where: {
        leadId: publicLeadId,
        journeyStatus: { not: "REJECTED" },
        ...(cpId ? { cpId } : {}),
        ...(projectId ? { projectId } : {}),
        ...(projectName
          ? { project: { name: { equals: projectName, mode: "insensitive" } } }
          : {}),
      },
      include,
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
        ...(cpId ? { cpId } : {}),
        ...(projectId ? { projectId } : {}),
        ...(projectName
          ? { project: { name: { equals: projectName, mode: "insensitive" } } }
          : {}),
      },
      include,
    });
  }

  if (leads.length === 0) {
    return apiError("Lead not found", 404);
  }

  // Scope to visiting/booking CP when provided (preferred path for multi-CP identity).
  if (cpId) {
    const scoped = leads.filter((l) => l.cpId === cpId);
    if (scoped.length === 0) {
      return apiError("No lead association found for the provided cpId", 404);
    }
    leads = scoped;
    matchedByExactId = true;
  }

  if (leads.length > 1 && !matchedByExactId) {
    return apiError(
      "Multiple leads matched. Send eoiCpLeadId, cpId, crmLeadId, projectId, or projectName to identify the particular lead.",
      409,
      "AMBIGUOUS_LEAD",
    );
  }

  const completedAt = parseEventDate(
    raw.completedAt || raw.occurredAt || raw.eventAt || raw.updatedAt,
  );

  if (
    event === "site_visit.completed" ||
    event === "lead.site_visit" ||
    event === "site_visit" ||
    event === "sitevisit.completed"
  ) {
    const visitedAt = completedAt || new Date();
    const changed = [];
    const notifyTargets = [];
    for (const lead of leads) {
      const wasComplete = lead.siteVisitStatus === "COMPLETED";
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          siteVisitStatus: "COMPLETED",
          siteVisitDate: visitedAt,
        },
      });
      changed.push(lead);
      // First completion always notifies; repeat visits notify so CP sees another check-in
      notifyTargets.push(lead);

      if (lead.identityId || lead.identity?.id) {
        try {
          await recordLeadEvent({
            identityId: lead.identityId || lead.identity!.id,
            type: "SITE_VISIT",
            leadId: lead.id,
            cpId: lead.cpId,
            projectId: lead.projectId,
            actorType: "RECEPTION",
            occurredAt: visitedAt,
            metadata: {
              salesperson,
              publicLeadId: lead.leadId,
              source: "reception_webhook",
              repeat: wasComplete,
            },
          });
        } catch (e) {
          console.error("[Reception webhook] LeadEvent SITE_VISIT failed", e);
        }
      }
    }

    const notificationResults = await Promise.allSettled(
      notifyTargets.map((lead) => notifyMilestone(lead, "SITE_VISIT_COMPLETED")),
    );
    logNotificationFailures(notificationResults);

    await writeAudit({
      action: "SITE_VISIT_COMPLETED_RECEPTION",
      entityType: "Lead",
      entityId: leads[0].id,
      metadata: {
        event,
        phone: mobile || undefined,
        leadId: publicLeadId,
        eoiCpLeadId: internalLeadId,
        cpId,
        count: changed.length,
        matched: leads.length,
        crmLeadId,
        projectId,
        projectName,
        salesperson,
      },
      ipAddress: getIpFromRequest(req),
    });

    return apiResponse({
      success: true,
      updated: changed.length,
      notified: notifyTargets.length,
      event: "site_visit.completed",
      cpId,
    });
  }

  if (
    event === "booking.confirmed" ||
    event === "booking.booked" ||
    event === "lead.booked" ||
    event === "booking.confirm"
  ) {
    const changed = [];
    for (const lead of leads) {
      const result = await prisma.lead.updateMany({
        where: {
          id: lead.id,
          OR: [
            { leadStatus: { not: "BOOKED" } },
            { journeyStatus: { not: "BOOKED" } },
            { siteVisitStatus: { not: "COMPLETED" } },
          ],
        },
        data: {
          leadStatus: "BOOKED",
          journeyStatus: "BOOKED",
          siteVisitStatus: "COMPLETED",
          ...(completedAt && lead.siteVisitStatus !== "COMPLETED"
            ? { siteVisitDate: completedAt }
            : {}),
        },
      });
      if (result.count === 1) changed.push(lead);

      if (lead.identityId || lead.identity?.id) {
        try {
          await recordLeadEvent({
            identityId: lead.identityId || lead.identity!.id,
            type: "BOOKED",
            leadId: lead.id,
            cpId: lead.cpId,
            projectId: lead.projectId,
            actorType: "RECEPTION",
            occurredAt: completedAt || new Date(),
            metadata: {
              salesperson,
              publicLeadId: lead.leadId,
              source: "reception_webhook",
            },
          });
        } catch (e) {
          console.error("[Reception webhook] LeadEvent BOOKED failed", e);
        }
      }
    }

    const notificationResults = await Promise.allSettled(
      changed.map((lead) => notifyMilestone(lead, "BOOKED")),
    );
    logNotificationFailures(notificationResults);

    await writeAudit({
      action: "LEAD_BOOKED_RECEPTION",
      entityType: "Lead",
      entityId: leads[0].id,
      metadata: {
        event,
        phone: mobile || undefined,
        leadId: publicLeadId,
        eoiCpLeadId: internalLeadId,
        cpId,
        count: changed.length,
        matched: leads.length,
        crmLeadId,
        projectId,
        projectName,
        salesperson,
      },
      ipAddress: getIpFromRequest(req),
    });

    return apiResponse({
      success: true,
      updated: changed.length,
      notified: changed.length,
      event: "booking.confirmed",
      cpId,
    });
  }

  return apiError(`Unsupported event: ${event || "(empty)"}`);
}

async function notifyMilestone(
  lead: Awaited<ReturnType<typeof getLeadForNotification>>,
  milestone: "SITE_VISIT_COMPLETED" | "BOOKED",
) {
  return NotificationService.notifyLeadMilestone({
    milestone,
    entityId: lead.id,
    leadId: lead.leadId || undefined,
    customerName: lead.customerName,
    customerEmail: lead.customerEmail,
    customerUserId: lead.customer?.user.id,
    cpName: lead.cp.user.name || lead.cp.companyName || "Channel Partner",
    cpEmail: lead.cp.user.email,
    cpUserId: lead.cp.user.id,
    projectName: lead.project.name,
  });
}

async function getLeadForNotification(id: string) {
  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id },
    include: {
      project: { select: { id: true, name: true } },
      cp: { include: { user: { select: { id: true, name: true, email: true } } } },
      customer: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  });
  return lead;
}

function parseEventDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function logNotificationFailures(results: PromiseSettledResult<unknown>[]) {
  for (const result of results) {
    if (result.status === "rejected") {
      console.error("[Reception webhook] milestone notification failed", result.reason);
    }
  }
}

function normalizeWebhookEvent(value: unknown): string {
  const normalized = String(value)
    .toLowerCase()
    .trim()
    .replace(/[\s_-]+/g, ".");

  if (
    normalized === "site.visit.done"
    || normalized === "site.visit.completed"
    || normalized === "site.visit"
    || normalized === "lead.site.visit"
    || normalized === "sitevisit.done"
    || normalized === "sitevisit.completed"
    || normalized === "sv.done"
  ) {
    return "site_visit.completed";
  }

  if (
    normalized === "booking.done"
    || normalized === "booking.confirmed"
    || normalized === "booking.booked"
    || normalized === "booked"
  ) {
    return "booking.confirmed";
  }

  return normalized;
}
