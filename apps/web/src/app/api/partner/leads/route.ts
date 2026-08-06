import { prisma } from "@goyal/db";
import { leadCreateSchema } from "@goyal/types";
import { withAuth, apiResponse, apiError, requireApprovedCP } from "@/lib/api";
import { generateInviteToken } from "@goyal/auth";
import { getAppBaseUrl, NotificationService } from "@goyal/email";
import { getSMSProvider } from "@goyal/integrations";
import { writeAudit, getIpFromRequest } from "@/lib/services/audit";
import { resolveLeadIntent } from "@/lib/leads/intent";
import { punchPartnerLeadToCrm } from "@/lib/services/goyal-crm-sync";
import {
  daysRemainingUntil,
  normalizeMobile,
  phoneLockWindowMs,
} from "@/lib/leads/phone";

class LeadCreateConflict extends Error {
  constructor(
    message: string,
    readonly code: "DUPLICATE_LEAD" | "IDENTITY_LOCKED",
  ) {
    super(message);
  }
}

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

  const [leads, projectAccess, cpIdentityLeads] = await Promise.all([
    prisma.lead.findMany({
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
                { leadId: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: {
        project: { select: { id: true, name: true, eoiStatus: true } },
        eoi: { select: { status: true, referenceNumber: true, chequeUploaded: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.cPProjectAccess.findMany({
      where: { cpId },
      include: {
        project: {
          select: { id: true, name: true, location: true, eoiStatus: true, status: true },
        },
      },
    }),
    prisma.lead.findMany({
      where: { cpId, journeyStatus: { not: "REJECTED" } },
      select: {
        projectId: true,
        customerMobile: true,
        customerEmail: true,
        leadId: true,
      },
    }),
  ]);

  const now = new Date();
  const identities = leads.flatMap((lead) => [
    { customerMobile: lead.customerMobile },
    { customerEmail: { equals: lead.customerEmail, mode: "insensitive" as const } },
  ]);
  const identityHistory = identities.length
    ? await prisma.lead.findMany({
        where: {
          OR: identities,
          journeyStatus: { not: "REJECTED" },
          createdAt: { gte: new Date(now.getTime() - phoneLockWindowMs()) },
        },
        select: {
          leadId: true,
          customerMobile: true,
          customerEmail: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const result = leads.map((lead) => {
    const sameIdentity = (candidate: {
      customerMobile: string;
      customerEmail: string;
    }) =>
      candidate.customerMobile === lead.customerMobile
      || candidate.customerEmail.toLowerCase() === lead.customerEmail.toLowerCase();
    const firstRegistration = identityHistory.find(sameIdentity);
    const lockExpiresAt = firstRegistration
      ? new Date(firstRegistration.createdAt.getTime() + phoneLockWindowMs())
      : new Date(lead.createdAt.getTime() + phoneLockWindowMs());
    const existingProjectIds = new Set(
      cpIdentityLeads
        .filter(sameIdentity)
        .map((candidate) => candidate.projectId),
    );
    const availableProjects = projectAccess
      .map((access) => access.project)
      .filter((project) => project.status === "ACTIVE" && !existingProjectIds.has(project.id))
      .map((project) => ({
        id: project.id,
        name: project.name,
        location: project.location,
        eoiStatus: project.eoiStatus,
        action: project.eoiStatus === "OPEN" ? "EOI" : "LEAD_ONLY",
      }));

    return {
      ...lead,
      lockExpiresAt: lockExpiresAt.toISOString(),
      lockDaysRemaining:
        lockExpiresAt > now ? daysRemainingUntil(lockExpiresAt, now) : 0,
      availableProjects,
    };
  });

  return apiResponse(result);
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

  const mobile = normalizeMobile(parsed.data.mobile);
  const email = parsed.data.email.trim().toLowerCase();
  if (mobile.length !== 10) {
    return apiError("Enter a valid 10-digit mobile number");
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

  const { generatePublicLeadId } = await import("@/lib/leads/id-generator");
  let lead;
  try {
    const createdId = await prisma.$transaction(
      async (tx) => {
        // Serialize both phone and email identities so simultaneous CP submissions
        // cannot bypass duplicate or 15-day ownership checks.
        const identityKeys = [`lead-email:${email}`, `lead-phone:${mobile}`].sort();
        for (const key of identityKeys) {
          // $executeRaw — pg_advisory_xact_lock returns void; $queryRaw fails to deserialize it.
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
        }

        const existingLead = await tx.lead.findFirst({
          where: {
            cpId,
            projectId: parsed.data.projectId,
            OR: [
              { customerMobile: mobile },
              { customerEmail: { equals: email, mode: "insensitive" } },
            ],
            journeyStatus: { not: "REJECTED" },
          },
          select: { id: true },
        });
        if (existingLead) {
          throw new LeadCreateConflict(
            "This customer is already registered on this project. Open the lead to punch another project.",
            "DUPLICATE_LEAD",
          );
        }

        const lockSince = new Date(Date.now() - phoneLockWindowMs());
        const lockedByOtherCp = await tx.lead.findFirst({
          where: {
            cpId: { not: cpId },
            createdAt: { gte: lockSince },
            journeyStatus: { not: "REJECTED" },
            OR: [
              { customerMobile: mobile },
              { customerEmail: { equals: email, mode: "insensitive" } },
            ],
          },
          orderBy: { createdAt: "asc" },
          select: { createdAt: true },
        });
        if (lockedByOtherCp) {
          const unlockAt = new Date(
            lockedByOtherCp.createdAt.getTime() + phoneLockWindowMs(),
          );
          const daysLeft = daysRemainingUntil(unlockAt);
          throw new LeadCreateConflict(
            `Another CP registered this phone number or email. Please try again after ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`,
            "IDENTITY_LOCKED",
          );
        }

        const existingIdentity = await tx.lead.findFirst({
          where: {
            leadId: { not: null },
            OR: [
              { customerMobile: mobile },
              { customerEmail: { equals: email, mode: "insensitive" } },
            ],
          },
          orderBy: { createdAt: "asc" },
          select: { leadId: true },
        });
        if (!existingIdentity?.leadId) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"lead-public-id-sequence"}, 0))`;
        }
        // Avoid full-table COUNT under the lock — approximate seq from recent max createdAt order.
        const latestForSeq = existingIdentity?.leadId
          ? null
          : await tx.lead.findFirst({
              where: { leadId: { not: null } },
              orderBy: { createdAt: "desc" },
              select: { leadId: true },
            });
        let seq = Date.now() % 1_000_000;
        if (latestForSeq?.leadId) {
          const match = latestForSeq.leadId.match(/(\d+)$/);
          if (match) seq = (Number(match[1]) % 1_000_000) + 1;
        }
        const publicLeadId =
          existingIdentity?.leadId
          || generatePublicLeadId(intentType, project.name, seq);

        const createdLead = await tx.lead.create({
          data: {
            leadId: publicLeadId,
            cpId,
            projectId: parsed.data.projectId,
            customerName: parsed.data.customerName,
            customerEmail: email,
            customerMobile: mobile,
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
          select: { id: true },
        });

        if (!isLeadOnly) {
          await tx.eOI.create({
            data: {
              leadId: createdLead.id,
              projectId: parsed.data.projectId,
              cpId,
              status: "PENDING_SUBMISSION",
            },
          });
        }
        return createdLead.id;
      },
      // Neon round-trips + advisory locks routinely exceed Prisma's 5s default.
      { isolationLevel: "Serializable", maxWait: 10_000, timeout: 25_000 },
    );

    lead = await prisma.lead.findUniqueOrThrow({
      where: { id: createdId },
      include: { project: true, cp: { include: { user: true } } },
    });
  } catch (creationError) {
    if (creationError instanceof LeadCreateConflict) {
      return apiError(creationError.message, 409, creationError.code);
    }
    console.error("[Partner leads] create failed:", creationError);
    const message =
      creationError instanceof Error ? creationError.message : "Failed to create lead";
    if (/unique|duplicate|P2002/i.test(message)) {
      return apiError(
        "This customer is already registered on this project. Open the lead to punch another project.",
        409,
        "DUPLICATE_LEAD",
      );
    }
    if (/serializ|deadlock|40001|40P01|P2028|timed out|timeout/i.test(message)) {
      return apiError("Another submission is in progress for this customer. Please try again.", 409);
    }
    return apiError("Failed to create lead. Please try again.", 500);
  }
  const publicLeadId = lead.leadId!;

  const baseUrl = getAppBaseUrl();
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
      leadId: publicLeadId,
      intentType,
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
  const crmResult = await punchPartnerLeadToCrm({
    leadDbId: lead.id,
    customerName: lead.customerName,
    customerEmail: lead.customerEmail,
    customerMobile: lead.customerMobile,
    projectName: lead.project.name,
    city: lead.city,
    fosName: lead.fosName,
    notes: lead.notes,
    intentType,
    publicLeadId,
  });
  titanCrmId = crmResult.crmId;

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
    lead: { ...lead, leadId: publicLeadId, titanCrmId: titanCrmId || lead.titanCrmId },
    intentType,
    sentConfirmation: emailSent,
    emailError,
    emailMocked,
    crmSynced: !!crmResult.success,
    crmId: titanCrmId,
    ...(process.env.NODE_ENV !== "production" && sendConfirmation
      ? { devConfirmationLinks: { acceptUrl, rejectUrl } }
      : {}),
  }, 201);
}
