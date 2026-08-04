import { prisma } from "@goyal/db";
import { confirmActionSchema } from "@goyal/types";
import { apiResponse, apiError } from "@/lib/api";
import { NotificationService } from "@goyal/email";
import { writeAudit, getIpFromRequest } from "@/lib/services/audit";
import { rateLimitAsync, getClientIp } from "@/lib/rate-limit";
import { ensureCustomerCredentials } from "@/lib/customer/credentials";

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

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const customerLoginUrl = `${baseUrl}/customer/login`;

  if (lead.confirmationStatus === "ACCEPTED") {
    return apiError("Confirmation already accepted", 409);
  }
  if (lead.confirmationStatus === "REJECTED") {
    return apiError("Confirmation already rejected", 409);
  }

  if (action === "accept") {
    const isLeadOnly = lead.intentType === "LEAD_ONLY";

    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        confirmationStatus: "ACCEPTED",
        confirmationRespondedAt: new Date(),
        journeyStatus: isLeadOnly ? "LEAD_CONFIRMED" : "ACTIVE",
        inviteExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    let emailSent = false;
    let tempPassword: string | undefined;

    try {
      const creds = await ensureCustomerCredentials({
        email: lead.customerEmail,
        name: lead.customerName,
        mobile: lead.customerMobile,
      });
      tempPassword = creds.password;

      const customer = await prisma.customer.findFirst({
        where: { user: { email: lead.customerEmail } },
      });
      if (customer) {
        await prisma.lead.update({
          where: { id: lead.id },
          data: { customerId: customer.id },
        });
      }
    } catch (e) {
      console.error("[Confirm] ensureCustomerCredentials failed:", e);
    }

    if (isLeadOnly) {
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
      loginUrl: customerLoginUrl,
      emailSent,
      leadId: lead.leadId,
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
