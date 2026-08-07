import { prisma } from "@goyal/db";
import { confirmActionSchema } from "@goyal/types";
import { apiResponse, apiError } from "@/lib/api";
import { getAppBaseUrl, NotificationService } from "@goyal/email";
import { writeAudit, getIpFromRequest } from "@/lib/services/audit";
import { rateLimitAsync, getClientIp } from "@/lib/rate-limit";
import { ensureCustomerCredentials } from "@/lib/customer/credentials";
import { punchPartnerLeadToCrm } from "@/lib/services/goyal-crm-sync";
import { recordLeadEvent, ensureLeadHasIdentity } from "@/lib/leads/identity";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const lead = await prisma.lead.findUnique({
    where: { inviteToken: token },
    include: {
      project: true,
      cp: { include: { user: true } },
    },
  });

  if (!lead) return apiError("Invalid confirmation link", 404);
  if (lead.inviteExpiresAt && lead.inviteExpiresAt < new Date()) {
    return apiError("Confirmation link has expired", 410);
  }

  return apiResponse({
    customerName: lead.customerName,
    cpName: lead.cp.user.name,
    companyName: lead.cp.companyName,
    project: { name: lead.project.name, location: lead.project.location },
    confirmationStatus: lead.confirmationStatus,
    journeyStatus: lead.journeyStatus,
    intentType: lead.intentType,
    leadId: lead.leadId,
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const ip = getClientIp(req);
  const limited = await rateLimitAsync(`confirm:${ip}`, 10, 60 * 60 * 1000);
  if (!limited.ok) return apiError("Too many requests. Try again later.", 429);

  const { token } = await params;
  const body = await req.json();
  const parsed = confirmActionSchema.safeParse(body);
  if (!parsed.success) return apiError("Invalid action");
  const { action } = parsed.data;
  const lead = await prisma.lead.findUnique({
    where: { inviteToken: token },
    include: {
      project: true,
      cp: { include: { user: true } },
    },
  });

  if (!lead) return apiError("Invalid confirmation link", 404);
  if (lead.inviteExpiresAt && lead.inviteExpiresAt < new Date()) {
    return apiError("Confirmation link has expired", 410);
  }

  const isLeadOnly = lead.intentType === "LEAD_ONLY";
  const customerLoginUrl = `${getAppBaseUrl()}/customer/login`;

  // Re-opening the same link (or a client retry) must not fail — replay the outcome.
  if (lead.confirmationStatus === "ACCEPTED") {
    if (action === "accept") {
      return apiResponse({
        success: true,
        action: "accepted",
        alreadyAccepted: true,
        intentType: lead.intentType,
        // Portal login is EOI-only; lead-only customers get a thanks page with no login CTA.
        ...(isLeadOnly ? {} : { loginUrl: customerLoginUrl }),
        leadId: lead.leadId,
        customerName: lead.customerName,
        customerEmail: lead.customerEmail,
        projectName: lead.project.name,
      });
    }
    return apiError(
      "You already accepted this invitation. Contact your Channel Partner if you want to change it.",
      409,
    );
  }
  if (lead.confirmationStatus === "REJECTED") {
    if (action === "reject") {
      return apiResponse({ success: true, action: "rejected", alreadyRejected: true });
    }
    return apiError(
      "This invitation was already declined. Ask your Channel Partner to send a new invitation.",
      409,
    );
  }

  if (action === "accept") {
    let emailSent = false;
    let tempPassword: string | undefined;

    // Customer portal credentials are for EOI completion only — never for lead-only.
    if (!isLeadOnly) {
      try {
        const creds = await ensureCustomerCredentials({
          email: lead.customerEmail,
          name: lead.customerName,
          mobile: lead.customerMobile,
        });
        tempPassword = creds.password;

        const customer = await prisma.customer.findFirst({
          where: {
            user: {
              email: { equals: lead.customerEmail.trim().toLowerCase(), mode: "insensitive" },
            },
          },
        });
        if (customer) {
          await prisma.lead.update({
            where: { id: lead.id },
            data: { customerId: customer.id },
          });
        }
      } catch (e) {
        console.error("[Confirm] ensureCustomerCredentials failed:", e);
        return apiError(
          "We could not create your customer login. Please retry or contact support.",
          500,
          "CUSTOMER_CREDENTIALS_FAILED",
        );
      }
    }

    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        confirmationStatus: "ACCEPTED",
        confirmationRespondedAt: new Date(),
        journeyStatus: isLeadOnly ? "LEAD_CONFIRMED" : "ACTIVE",
        inviteExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    if (isLeadOnly) {
      // Punch to CRM only after the customer accepts a lead-only confirmation.
      if (!lead.titanCrmId) {
        try {
          await punchPartnerLeadToCrm({
            leadDbId: lead.id,
            customerName: lead.customerName,
            customerEmail: lead.customerEmail,
            customerMobile: lead.customerMobile,
            projectName: lead.project.name,
            city: lead.city,
            fosName: lead.fosName,
            notes: lead.notes,
            intentType: "LEAD_ONLY",
            publicLeadId: lead.leadId,
          });
        } catch (e) {
          console.error("[Confirm] lead-only CRM punch failed:", e);
        }
      }

      const emailResult = await NotificationService.notifyLeadOnlyAccepted({
        customerEmail: lead.customerEmail,
        customerName: lead.customerName,
        cpName: lead.cp.user.name || "Channel Partner",
        projectName: lead.project.name,
        projectLocation: lead.project.location,
        entityId: lead.id,
        leadId: lead.leadId || lead.id,
      });
      emailSent = !!emailResult.success && !emailResult.skipped && !emailResult.mocked;

      if (lead.cp.user) {
        await NotificationService.notifyCPLeadOnlyAccepted({
          cpUserId: lead.cp.user.id,
          cpEmail: lead.cp.user.email,
          cpName: lead.cp.user.name || "Partner",
          customerName: lead.customerName,
          projectName: lead.project.name,
          leadId: lead.leadId || undefined,
          entityId: lead.id,
        });
      }

      try {
        const identityId = await ensureLeadHasIdentity(lead);
        await recordLeadEvent({
          identityId,
          type: "CONFIRMED",
          leadId: lead.id,
          cpId: lead.cpId,
          projectId: lead.projectId,
          actorType: "CUSTOMER",
          metadata: { intentType: "LEAD_ONLY" },
        });
      } catch (e) {
        console.error("[confirm] LeadEvent CONFIRMED failed", e);
      }
    } else {
      const emailResult = await NotificationService.notifyEOIInvitation({
        customerEmail: lead.customerEmail,
        customerName: lead.customerName,
        cpName: lead.cp.user.name || "Channel Partner",
        projectName: lead.project.name,
        projectLocation: lead.project.location,
        startingPrice: `₹${Number(lead.project.startingPrice).toLocaleString("en-IN")}`,
        inviteUrl: customerLoginUrl,
        customerLoginUrl,
        password: tempPassword,
        leadId: lead.leadId || undefined,
      });
      emailSent = !!emailResult.success && !emailResult.skipped && !emailResult.mocked;
    }

    if (!isLeadOnly) {
      try {
        const identityId = await ensureLeadHasIdentity(lead);
        await recordLeadEvent({
          identityId,
          type: "CONFIRMED",
          leadId: lead.id,
          cpId: lead.cpId,
          projectId: lead.projectId,
          actorType: "CUSTOMER",
          metadata: { intentType: "EOI" },
        });
      } catch (e) {
        console.error("[confirm] LeadEvent CONFIRMED EOI failed", e);
      }
    }

    await writeAudit({
      action: isLeadOnly ? "LEAD_ONLY_CONFIRMED" : "CUSTOMER_CONFIRMATION_ACCEPTED",
      entityType: "Lead",
      entityId: lead.id,
      metadata: { customerEmail: lead.customerEmail, cpId: lead.cpId, intentType: lead.intentType },
      ipAddress: getIpFromRequest(req),
    });

    return apiResponse({
      success: true,
      action: "accepted",
      intentType: lead.intentType,
      ...(isLeadOnly ? {} : { loginUrl: customerLoginUrl, passwordEmailed: !!tempPassword }),
      emailSent,
      leadId: lead.leadId,
      customerName: lead.customerName,
      customerEmail: lead.customerEmail,
      projectName: lead.project.name,
    });
  }

  if (action === "reject") {
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        confirmationStatus: "REJECTED",
        confirmationRespondedAt: new Date(),
        journeyStatus: "REJECTED",
      },
    });

    if (lead.cp.user) {
      await NotificationService.notifyCPCustomerRejected({
        cpUserId: lead.cp.user.id,
        cpEmail: lead.cp.user.email,
        cpName: lead.cp.user.name || "Partner",
        customerName: lead.customerName,
        projectName: lead.project.name,
        leadId: lead.id,
      });
    }

    try {
      const identityId = await ensureLeadHasIdentity(lead);
      await recordLeadEvent({
        identityId,
        type: "REJECTED",
        leadId: lead.id,
        cpId: lead.cpId,
        projectId: lead.projectId,
        actorType: "CUSTOMER",
      });
    } catch (e) {
      console.error("[confirm] LeadEvent REJECTED failed", e);
    }

    await writeAudit({
      action: "CUSTOMER_CONFIRMATION_REJECTED",
      entityType: "Lead",
      entityId: lead.id,
      metadata: { customerEmail: lead.customerEmail, cpId: lead.cpId },
      ipAddress: getIpFromRequest(req),
    });

    return apiResponse({ success: true, action: "rejected" });
  }

  return apiError("Invalid action");
}
