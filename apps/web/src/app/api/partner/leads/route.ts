import { prisma } from "@goyal/db";
import { leadCreateSchema } from "@goyal/types";
import { withAuth, apiResponse, apiError, requireApprovedCP } from "@/lib/api";
import { generateInviteToken } from "@goyal/auth";
import { NotificationService } from "@goyal/email";
import { getSMSProvider, getCRMProvider } from "@goyal/integrations";
import { writeAudit, getIpFromRequest } from "@/lib/services/audit";
import { resolveLeadIntent } from "@/lib/leads/intent";

export async function GET(req: Request) {
  const { error, session } = await withAuth(["CHANNEL_PARTNER"]);
  if (error) return error;
  const cpError = await requireApprovedCP(session!);
  if (cpError) return cpError;

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const status = searchParams.get("status");
  const intentType = searchParams.get("intentType");
  const search = searchParams.get("search")?.trim();
  const fromDate = searchParams.get("fromDate");
  const toDate = searchParams.get("toDate");
  const fosName = searchParams.get("fosName")?.trim();

  const createdAtFilter: { gte?: Date; lte?: Date } = {};
  if (fromDate) {
    const from = new Date(fromDate);
    from.setHours(0, 0, 0, 0);
    createdAtFilter.gte = from;
  }
  if (toDate) {
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999);
    createdAtFilter.lte = to;
  }

  const cpId = session!.user.cpId!;

  // Auto-complete site visits whose scheduled date has passed
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  await prisma.lead.updateMany({
    where: {
      cpId,
      siteVisitStatus: "SCHEDULED",
      siteVisitDate: { lte: startOfToday },
    },
    data: { siteVisitStatus: "COMPLETED" },
  });

  const leads = await prisma.lead.findMany({
    where: {
      cpId,
      ...(projectId ? { projectId } : {}),
      ...(status ? { journeyStatus: status as never } : {}),
      ...(intentType === "EOI" || intentType === "LEAD_ONLY" ? { intentType } : {}),
      ...(fosName ? { fosName: { equals: fosName, mode: "insensitive" } } : {}),
      ...(Object.keys(createdAtFilter).length ? { createdAt: createdAtFilter } : {}),
      ...(search
        ? {
            OR: [
              { customerName: { contains: search, mode: "insensitive" } },
              { customerEmail: { contains: search, mode: "insensitive" } },
              { customerMobile: { contains: search } },
            ],
          }
        : {}),
    },
    include: {
      project: { select: { name: true, eoiStatus: true } },
      eoi: { select: { status: true, referenceNumber: true, chequeUploaded: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return apiResponse(leads);
}

export async function POST(req: Request) {
  const { error, session } = await withAuth(["CHANNEL_PARTNER"]);
  if (error) return error;
  const cpError = await requireApprovedCP(session!);
  if (cpError) return cpError;

  const body = await req.json();
  const parsed = leadCreateSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0].message);

  const cpId = session!.user.cpId!;

  const project = await prisma.project.findUnique({
    where: { id: parsed.data.projectId },
    select: { eoiStatus: true, name: true },
  });
  if (!project) return apiError("Project not found", 404);

  let intentType = parsed.data.intentType ?? (project.eoiStatus === "CLOSED" ? "LEAD_ONLY" : "EOI");

  const resolved = resolveLeadIntent(project.eoiStatus as "OPEN" | "CLOSED", intentType);
  if ("error" in resolved) return apiError(resolved.error, resolved.status);
  intentType = resolved.intentType;

  const access = await prisma.cPProjectAccess.findUnique({
    where: { cpId_projectId: { cpId, projectId: parsed.data.projectId } },
  });
  if (!access) return apiError("You do not have access to this project", 403);

  const existingLead = await prisma.lead.findFirst({
    where: {
      cpId,
      projectId: parsed.data.projectId,
      customerEmail: { equals: parsed.data.email, mode: "insensitive" },
      journeyStatus: { not: "REJECTED" },
    },
    select: { id: true, journeyStatus: true },
  });

  if (existingLead) {
    return apiError(
      "A lead already exists for this customer on this project",
      409,
      "DUPLICATE_LEAD",
    );
  }

  const inviteToken = generateInviteToken();
  const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const isLeadOnly = intentType === "LEAD_ONLY";
  const sendConfirmation = parsed.data.sendConfirmation ?? false;

  if (!isLeadOnly && sendConfirmation) {
    if (!(parsed.data.configuration || "").trim()) {
      return apiError("Unit preference is required");
    }
    if (!(parsed.data.fosName || "").trim()) {
      return apiError("FOS name is required");
    }
  }

  const leadCount = await prisma.lead.count({ where: { projectId: parsed.data.projectId } });
  const { generatePublicLeadId } = await import("@/lib/leads/id-generator");
  const publicLeadId = generatePublicLeadId(intentType, project.name, leadCount + 1);

  const lead = await prisma.lead.create({
    data: {
      leadId: publicLeadId,
      cpId,
      projectId: parsed.data.projectId,
      customerName: parsed.data.customerName,
      customerEmail: parsed.data.email,
      customerMobile: parsed.data.mobile,
      configuration: parsed.data.configuration || null,
      fosName: parsed.data.fosName || null,
      budget: parsed.data.budget,
      city: parsed.data.city,
      notes: parsed.data.notes,
      intentType,
      journeyStatus: sendConfirmation ? "CONFIRMATION_PENDING" : "DRAFT",
      confirmationStatus: sendConfirmation ? "PENDING" : null,
      confirmationSentAt: sendConfirmation ? new Date() : null,
      leadStatus: "LEAD_REGISTERED",
      inviteToken,
      inviteExpiresAt,
    },
    include: { project: true, cp: { include: { user: true } } },
  });

  if (!isLeadOnly) {
    await prisma.eOI.create({
      data: {
        leadId: lead.id,
        projectId: lead.projectId,
        cpId: lead.cpId,
        status: "PENDING_SUBMISSION",
      },
    });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const acceptUrl = `${baseUrl}/confirm/${inviteToken}/accept`;
  const rejectUrl = `${baseUrl}/confirm/${inviteToken}/reject`;

  let emailSent = false;
  let emailError: string | undefined;
  let emailMocked = false;

  if (sendConfirmation) {
    const emailResult = await NotificationService.notifyCustomerConfirmation({
      customerEmail: lead.customerEmail,
      customerName: lead.customerName,
      cpName: lead.cp.user.name || "Channel Partner",
      companyName: lead.cp.companyName || undefined,
      projectName: lead.project.name,
      projectLocation: lead.project.location,
      acceptUrl,
      rejectUrl,
      entityId: lead.id,
    });

    emailMocked = !!emailResult.mocked;
    emailSent = !!emailResult.success && !emailResult.skipped && !emailResult.mocked;
    if (!emailSent) {
      emailError = emailResult.mocked
        ? "Email not sent — BREVO_API_KEY not loaded. Restart the dev server after saving .env.local"
        : (emailResult.error || "Failed to send confirmation email");
    } else {
      const sms = getSMSProvider();
      await sms.sendSMS(
        lead.customerMobile,
        `Goyal Hariyana Projects: ${lead.cp.user.name} invites you to confirm your interest in ${lead.project.name}. Check your email for the confirmation link.`
      );
    }
  }

  let titanCrmId: string | undefined;
  try {
    const crm = getCRMProvider();
    const crmResult = await crm.syncLead({
      leadId: publicLeadId,
      customerName: lead.customerName,
      email: lead.customerEmail,
      mobile: lead.customerMobile,
      projectName: lead.project.name,
      intentType,
      category: intentType === "EOI" ? "EOI" : "LEADS",
    });
    titanCrmId = crmResult.crmId;
    if (titanCrmId) {
      await prisma.lead.update({ where: { id: lead.id }, data: { titanCrmId } });
    }
  } catch (e) {
    console.error("[CRM] syncLead failed:", e);
  }

  try {
    const { publishEvent } = await import("@goyal/integration-hub");
    await publishEvent({
      type: "lead.created",
      entityId: lead.id,
      payload: {
        leadId: publicLeadId,
        eoiCpLeadId: lead.id,
        customerName: lead.customerName,
        customerEmail: lead.customerEmail,
        customerPhone: lead.customerMobile,
        customerMobile: lead.customerMobile,
        projectId: lead.projectId,
        titanCrmId,
        cpId: lead.cpId,
        intentType,
      },
    });
    await prisma.lead.update({
      where: { id: lead.id },
      data: { bookingLeadId: publicLeadId },
    });
  } catch (e) {
    console.error("[Integration Hub] lead.created failed:", e);
  }

  await writeAudit({
    actorId: session!.user.id,
    action: isLeadOnly
      ? "LEAD_ONLY_PUNCHED"
      : sendConfirmation
        ? "LEAD_CREATED_WITH_CONFIRMATION"
        : "LEAD_CREATED_DRAFT",
    entityType: "Lead",
    entityId: lead.id,
    metadata: { customerEmail: lead.customerEmail, projectId: lead.projectId, intentType },
    ipAddress: getIpFromRequest(req),
  });

  return apiResponse({
    lead,
    intentType,
    sentConfirmation: emailSent,
    emailError,
    emailMocked,
    ...(process.env.NODE_ENV !== "production" && sendConfirmation
      ? { devConfirmationLinks: { acceptUrl, rejectUrl } }
      : {}),
  }, 201);
}
