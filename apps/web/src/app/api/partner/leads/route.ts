import { prisma } from "@goyal/db";
import { leadCreateSchema } from "@goyal/types";
import { withPartnerAuth, apiResponse, apiError, requireApprovedCP, withApiRoute } from "@/lib/api";
import { logServerError } from "@/lib/server-log";
import { NextResponse } from "next/server";
import { generateInviteToken } from "@goyal/auth";
import { getCustomerConfirmUrl, NotificationService } from "@goyal/email";
import { getSMSProvider } from "@goyal/integrations";
import { writeAudit, getIpFromRequest } from "@/lib/services/audit";
import { resolveLeadIntent } from "@/lib/leads/intent";
import {
  evaluateIdentityLock,
  getIdentityPunchContext,
  batchResolvePartnerLockStates,
} from "@/lib/leads/identity-context";
import { recordLeadEvent, resolveOrCreateLeadIdentity } from "@/lib/leads/identity";
import { normalizeMobile, daysRemainingUntil, phoneLockWindowMs } from "@/lib/leads/phone";
import { resolveTeamMemberForLead } from "@/lib/services/team-members";
import { getPartnerScope, leadScopeWhere } from "@/lib/partner-scope";
import { deferWork } from "@/lib/defer";

/** Punch returns after DB commit; CRM/email run in background. */
export const maxDuration = 60;

class LeadCreateConflict extends Error {
  constructor(
    message: string,
    readonly code: "DUPLICATE_LEAD" | "IDENTITY_LOCKED" | "PRIOR_CP_COOLDOWN",
  ) {
    super(message);
    this.name = "LeadCreateConflict";
  }
}

function isLeadCreateConflict(
  error: unknown,
): error is { message: string; code: "DUPLICATE_LEAD" | "IDENTITY_LOCKED" | "PRIOR_CP_COOLDOWN" } {
  if (error instanceof LeadCreateConflict) return true;
  if (!error || typeof error !== "object") return false;
  const e = error as { name?: string; code?: unknown; message?: unknown };
  return (
    e.name === "LeadCreateConflict"
    && (e.code === "DUPLICATE_LEAD" || e.code === "IDENTITY_LOCKED" || e.code === "PRIOR_CP_COOLDOWN")
    && typeof e.message === "string"
  );
}

function serializePartnerLead(lead: {
  id: string;
  leadId: string | null;
  titanCrmId: string | null;
  customerName: string;
  customerEmail: string;
  customerMobile: string;
  configuration: string | null;
  fosName: string | null;
  budget: string | null;
  city: string | null;
  notes: string | null;
  intentType: string;
  journeyStatus: string;
  confirmationStatus: string | null;
  project: { id: string; name: string; location: string; eoiStatus: string };
  cp: { companyName: string | null; user: { name: string | null } };
}, publicLeadId: string, titanCrmId?: string) {
  return {
    id: lead.id,
    leadId: publicLeadId,
    titanCrmId: titanCrmId || lead.titanCrmId,
    customerName: lead.customerName,
    customerEmail: lead.customerEmail,
    customerMobile: lead.customerMobile,
    configuration: lead.configuration,
    fosName: lead.fosName,
    budget: lead.budget,
    city: lead.city,
    notes: lead.notes,
    intentType: lead.intentType,
    journeyStatus: lead.journeyStatus,
    confirmationStatus: lead.confirmationStatus,
    project: {
      id: lead.project.id,
      name: lead.project.name,
      location: lead.project.location,
      eoiStatus: lead.project.eoiStatus,
    },
    cp: {
      companyName: lead.cp.companyName,
      user: { name: lead.cp.user.name },
    },
  };
}

export const GET = withApiRoute("partner.leads.get", async (req: Request) => {
  const { error, session } = await withPartnerAuth();
  if (error) return error;
  const cpError = await requireApprovedCP(session!);
  if (cpError) return cpError;

  const { searchParams } = new URL(req.url);
  const facet = searchParams.get("facet")?.trim();
  const projectId = searchParams.get("projectId");
  const status = searchParams.get("status");
  const intentType = searchParams.get("intentType");
  const search = searchParams.get("search")?.trim();
  const fromDate = searchParams.get("fromDate");
  const toDate = searchParams.get("toDate");
  const fosName = searchParams.get("fosName")?.trim();
  const teamMemberId = searchParams.get("teamMemberId")?.trim();
  const page = Math.max(1, Number(searchParams.get("page") || "1") || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || "40") || 40));
  const includeHistory = searchParams.get("includeHistory") === "1";

  const cpId = session!.user.cpId!;
  const memberScope = leadScopeWhere(session!);

  // Lightweight facet for dashboard FOS filters — no lock / page payload.
  if (facet === "fosNames") {
    const rows = await prisma.lead.findMany({
      where: {
        cpId,
        ...memberScope,
        fosName: { not: null },
      },
      select: { fosName: true },
      distinct: ["fosName"],
      orderBy: { fosName: "asc" },
      take: 200,
    });
    return apiResponse({
      fosNames: rows
        .map((r) => r.fosName?.trim())
        .filter((name): name is string => Boolean(name)),
    });
  }

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

  const where = {
    cpId,
    ...memberScope,
    ...(projectId ? { projectId } : {}),
    ...(status ? { journeyStatus: status as never } : {}),
    ...(intentType === "EOI" || intentType === "LEAD_ONLY"
      ? { intentType: intentType as "EOI" | "LEAD_ONLY" }
      : {}),
    ...(fosName ? { fosName: { equals: fosName, mode: "insensitive" as const } } : {}),
    ...(teamMemberId ? { teamMemberId } : {}),
    ...(Object.keys(createdAtFilter).length ? { createdAt: createdAtFilter } : {}),
    ...(search
      ? {
          OR: [
            { customerName: { contains: search, mode: "insensitive" as const } },
            { customerEmail: { contains: search, mode: "insensitive" as const } },
            { customerMobile: { contains: search } },
            { leadId: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, leads, projectAccess] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.findMany({
      where,
      include: {
        project: { select: { id: true, name: true, eoiStatus: true } },
        eoi: { select: { status: true, referenceNumber: true, chequeUploaded: true } },
        teamMember: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.cPProjectAccess.findMany({
      where: { cpId },
      include: {
        project: {
          select: { id: true, name: true, location: true, eoiStatus: true, status: true },
        },
      },
    }),
  ]);

  const phones = [...new Set(leads.map((l) => l.customerMobile).filter(Boolean))];
  const emails = [...new Set(leads.map((l) => l.customerEmail.trim().toLowerCase()).filter(Boolean))];

  const identities = leads.map((l) => ({
    mobile: normalizeMobile(l.customerMobile),
    email: l.customerEmail.trim().toLowerCase(),
  }));

  const now = new Date();

  const [cpIdentityLeads, lockCache] = await Promise.all([
    phones.length || emails.length
      ? prisma.lead.findMany({
          where: {
            cpId,
            journeyStatus: { not: "REJECTED" },
            OR: [
              ...(phones.length ? [{ customerMobile: { in: phones } }] : []),
              ...(emails.length
                ? emails.map((e) => ({ customerEmail: { equals: e, mode: "insensitive" as const } }))
                : []),
            ],
          },
          select: {
            projectId: true,
            customerMobile: true,
            customerEmail: true,
            leadId: true,
          },
        })
      : Promise.resolve([]),
    batchResolvePartnerLockStates({ cpId, identities, now }),
  ]);

  const result = leads.map((lead) => {
    const sameIdentity = (candidate: {
      customerMobile: string;
      customerEmail: string;
    }) =>
      candidate.customerMobile === lead.customerMobile
      || candidate.customerEmail.toLowerCase() === lead.customerEmail.toLowerCase();
    const existingProjectIds = new Set(
      cpIdentityLeads
        .filter(sameIdentity)
        .map((candidate) => candidate.projectId),
    );
    const availableProjects = projectAccess
      .map((access) => access.project)
      .filter(
        (project) =>
          (project.status === "ACTIVE" || project.status === "UPCOMING")
          && !existingProjectIds.has(project.id),
      )
      .map((project) => ({
        id: project.id,
        name: project.name,
        location: project.location,
        eoiStatus: project.eoiStatus,
        action: project.eoiStatus === "OPEN" ? "EOI" : "LEAD_ONLY",
      }));
    const mappedProjects = projectAccess
      .map((access) => access.project)
      .filter((project) => existingProjectIds.has(project.id))
      .map((project) => ({
        id: project.id,
        name: project.name,
        eoiStatus: project.eoiStatus,
        action: project.eoiStatus === "OPEN" ? "EOI" : "LEAD_ONLY",
      }));

    const lockKey = `${normalizeMobile(lead.customerMobile)}|${lead.customerEmail.trim().toLowerCase()}`;
    const lock = lockCache.get(lockKey)!;

    return {
      ...lead,
      lockStatus: lock.lockStatus,
      isActiveLockHolder: lock.isActiveLockHolder,
      lockExpiresAt: lock.lockExpiresAt,
      lockDaysRemaining: lock.lockDaysRemaining,
      cooldownExpiresAt: lock.cooldownExpiresAt,
      cooldownDaysRemaining: lock.cooldownDaysRemaining,
      canActivate: lock.canActivate,
      availableProjects,
      mappedProjects,
      siteVisitHistory: [] as Array<{
        id: string;
        type?: string;
        occurredAt: string;
        projectName: string | null;
        salesperson: string | null;
        metadata: unknown;
      }>,
    };
  });

  if (includeHistory) {
    const leadIds = result.map((l) => l.id);
    const identityIds = [
      ...new Set(
        leads.map((l) => l.identityId).filter((id): id is string => Boolean(id)),
      ),
    ];
    if (identityIds.length && leadIds.length) {
      const events = await prisma.leadEvent.findMany({
        where: {
          identityId: { in: identityIds },
          cpId,
          type: { in: ["SITE_VISIT", "BOOKED"] },
        },
        orderBy: { occurredAt: "desc" },
        take: 100,
        include: { project: { select: { name: true } } },
      });
      const byLead = new Map<string, typeof events>();
      for (const ev of events) {
        if (!ev.leadId) continue;
        const list = byLead.get(ev.leadId) || [];
        list.push(ev);
        byLead.set(ev.leadId, list);
      }
      for (const row of result) {
        const list = byLead.get(row.id) || [];
        row.siteVisitHistory = list.map((ev) => ({
          id: ev.id,
          type: ev.type,
          occurredAt: ev.occurredAt.toISOString(),
          projectName: ev.project?.name || null,
          salesperson:
            ev.metadata && typeof ev.metadata === "object" && "salesperson" in ev.metadata
              ? String((ev.metadata as { salesperson?: unknown }).salesperson || "") || null
              : null,
          metadata: ev.metadata,
        }));
      }
    }
  }

  return apiResponse({
    items: result,
    total,
    page,
    pageSize,
  });
});

export const POST = withApiRoute("partner.leads.create", async (req: Request) => {
  const tag = (res: Response) => {
    // Lets us confirm which deployment is serving leads.partnergoyalco.com
    res.headers.set("x-eoi-punch", "v4");
    return res;
  };
  try {
    return tag(await postPartnerLead(req));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    logServerError("partner.leads.create", "Unhandled POST error", { status: 500 }, error);
    return tag(
      NextResponse.json(
        { error: "Failed to create lead. Please try again.", detail },
        { status: 500 },
      ),
    );
  }
});

async function postPartnerLead(req: Request) {
  const { error, session } = await withPartnerAuth();
  if (error) return error;
  const cpError = await requireApprovedCP(session!);
  if (cpError) return cpError;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid request body", 400);
  }
  const parsed = leadCreateSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0].message);

  const cpId = session!.user.cpId!;

  const [project, access] = await Promise.all([
    prisma.project.findUnique({
      where: { id: parsed.data.projectId },
      select: { eoiStatus: true, name: true, location: true },
    }),
    prisma.cPProjectAccess.findUnique({
      where: { cpId_projectId: { cpId, projectId: parsed.data.projectId } },
      select: { id: true },
    }),
  ]);
  if (!project) return apiError("Project not found", 404);
  if (!access) return apiError("You do not have access to this project", 403);

  let intentType = parsed.data.intentType ?? (project.eoiStatus === "CLOSED" ? "LEAD_ONLY" : "EOI");

  const resolved = resolveLeadIntent(project.eoiStatus as "OPEN" | "CLOSED", intentType);
  if ("error" in resolved) return apiError(resolved.error, resolved.status);
  intentType = resolved.intentType;

  const mobile = normalizeMobile(parsed.data.mobile);
  const email = parsed.data.email.trim().toLowerCase();
  if (mobile.length !== 10) {
    return apiError("Enter a valid 10-digit mobile number");
  }

  const inviteToken = generateInviteToken();
  const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const isLeadOnly = intentType === "LEAD_ONLY";
  const scope = getPartnerScope(session!);

  let teamAssignment: { teamMemberId: string | null; fosName: string | null };
  let priorCpLeads: number;
  let existingLead: { id: string } | null;
  let lockEval: Awaited<ReturnType<typeof evaluateIdentityLock>>;
  try {
    const [assignment, priorCount, existing, lock] = await Promise.all([
      resolveTeamMemberForLead(
        cpId,
        scope.teamMemberId ?? parsed.data.teamMemberId,
        scope.teamMemberId ? null : parsed.data.fosName,
      ),
      prisma.lead.count({
        where: {
          cpId,
          journeyStatus: { not: "REJECTED" },
          OR: [
            { customerMobile: mobile },
            { customerEmail: { equals: email, mode: "insensitive" } },
          ],
        },
      }),
      prisma.lead.findFirst({
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
      }),
      evaluateIdentityLock({ cpId, mobile, email }),
    ]);
    teamAssignment = assignment;
    priorCpLeads = priorCount;
    existingLead = existing;
    lockEval = lock;
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid team member") {
      return apiError("Invalid team member", 400);
    }
    throw error;
  }

  const isRemap = priorCpLeads > 0;
  let sendConfirmation = parsed.data.sendConfirmation ?? false;
  if (isRemap && project.eoiStatus !== "OPEN") {
    sendConfirmation = false;
  }

  if (!isLeadOnly && sendConfirmation) {
    if (!(parsed.data.configuration || "").trim()) {
      return apiError("Unit preference is required");
    }
    if (!scope.teamMemberId && !(parsed.data.teamMemberId || parsed.data.fosName || "").trim()) {
      return apiError("Team member is required");
    }
  }

  let lead;
  let lockExpiresAtIso: string | null = null;
  let lockDaysRemaining = 0;
  try {
    if (existingLead) {
      throw new LeadCreateConflict(
        "This customer is already registered on this project. Open the lead to punch another project.",
        "DUPLICATE_LEAD",
      );
    }

    if (!lockEval.ok) {
      throw new LeadCreateConflict(lockEval.message, lockEval.code);
    }
    if (lockEval.lockExpiresAt) {
      lockExpiresAtIso = lockEval.lockExpiresAt.toISOString();
      lockDaysRemaining = daysRemainingUntil(lockEval.lockExpiresAt);
    } else {
      const approx = new Date(Date.now() + phoneLockWindowMs());
      lockExpiresAtIso = approx.toISOString();
      lockDaysRemaining = daysRemainingUntil(approx);
    }

    const identity = await resolveOrCreateLeadIdentity({
      mobile,
      email,
      intentType,
      projectName: project.name,
    });

    // Other CP attaching after lock → CP_ATTACHED; same CP remap → MAPPED; first → PUNCHED
    const otherCpOnIdentity = await prisma.lead.findFirst({
      where: {
        identityId: identity.identityId,
        cpId: { not: cpId },
        journeyStatus: { not: "REJECTED" },
      },
      select: { id: true },
    });

    const createdLead = await prisma.lead.create({
      data: {
        leadId: identity.publicLeadId,
        identityId: identity.identityId,
        cpId,
        projectId: parsed.data.projectId,
        customerName: parsed.data.customerName,
        customerEmail: email,
        customerMobile: mobile,
        configuration: parsed.data.configuration || null,
        fosName: teamAssignment.fosName,
        teamMemberId: teamAssignment.teamMemberId,
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
      include: {
        project: { select: { id: true, name: true, location: true, eoiStatus: true } },
        cp: { select: { companyName: true, user: { select: { name: true } } } },
      },
    });

    if (!isLeadOnly) {
      await prisma.eOI.create({
        data: {
          leadId: createdLead.id,
          projectId: parsed.data.projectId,
          cpId,
          status: "PENDING_SUBMISSION",
        },
      });
    }

    const eventType = isRemap
      ? "MAPPED"
      : otherCpOnIdentity
        ? "CP_ATTACHED"
        : "PUNCHED";

    // Events are important but not needed for the punch HTTP response.
    deferWork("partner.lead.events", async () => {
      await recordLeadEvent({
        identityId: identity.identityId,
        type: eventType,
        leadId: createdLead.id,
        cpId,
        projectId: parsed.data.projectId,
        actorType: "CP",
        metadata: {
          intentType,
          sendConfirmation,
          isRemap,
          identityCreated: identity.created,
        },
      });
      if (identity.created) {
        await recordLeadEvent({
          identityId: identity.identityId,
          type: "LOCK_STARTED",
          leadId: createdLead.id,
          cpId,
          projectId: parsed.data.projectId,
          actorType: "SYSTEM",
        });
      }
    });

    lead = createdLead;
  } catch (creationError) {
    if (isLeadCreateConflict(creationError)) {
      if (creationError.code === "DUPLICATE_LEAD") {
        const context = await getIdentityPunchContext(cpId, mobile, email);
        return apiError(creationError.message, 409, creationError.code, {
          existingLeadId: context.existingLeadId,
          leadId: context.publicLeadId,
          availableProjects: context.availableProjects,
          mappedProjects: context.mappedProjects,
          lockExpiresAt: context.lockExpiresAt,
          lockDaysRemaining: context.lockDaysRemaining,
        });
      }
      return apiError(creationError.message, 409, creationError.code);
    }
    console.error("[Partner leads] create failed:", creationError);
    const message =
      creationError instanceof Error ? creationError.message : "Failed to create lead";
    if (/unique|duplicate|P2002/i.test(message)) {
      const context = await getIdentityPunchContext(cpId, mobile, email);
      return apiError(
        "This customer is already registered on this project. Open the lead to punch another project.",
        409,
        "DUPLICATE_LEAD",
        {
          existingLeadId: context.existingLeadId,
          leadId: context.publicLeadId,
          availableProjects: context.availableProjects,
          mappedProjects: context.mappedProjects,
          lockExpiresAt: context.lockExpiresAt,
          lockDaysRemaining: context.lockDaysRemaining,
        },
      );
    }
    if (/serializ|deadlock|40001|40P01|P2028|timed out|timeout/i.test(message)) {
      return apiError("Another submission is in progress for this customer. Please try again.", 409);
    }
    return NextResponse.json(
      {
        error: "Failed to create lead. Please try again.",
        detail: message,
      },
      { status: 500 },
    );
  }

  const publicLeadId = lead.leadId!;

  const acceptUrl = getCustomerConfirmUrl(inviteToken, "accept");
  const rejectUrl = getCustomerConfirmUrl(inviteToken, "reject");

  const leadSnapshot = {
    id: lead.id,
    customerEmail: lead.customerEmail,
    customerName: lead.customerName,
    customerMobile: lead.customerMobile,
    city: lead.city,
    fosName: lead.fosName,
    notes: lead.notes,
    projectId: lead.projectId,
    cpId: lead.cpId,
    projectName: lead.project.name,
    projectLocation: lead.project.location,
    cpName: lead.cp.user.name || "Channel Partner",
    companyName: lead.cp.companyName || undefined,
  };

  deferWork("partner.lead.side-effects", async () => {
    if (sendConfirmation) {
      try {
        const emailResult = await NotificationService.notifyCustomerConfirmation({
          customerEmail: leadSnapshot.customerEmail,
          customerName: leadSnapshot.customerName,
          cpName: leadSnapshot.cpName,
          companyName: leadSnapshot.companyName,
          projectName: leadSnapshot.projectName,
          projectLocation: leadSnapshot.projectLocation,
          acceptUrl,
          rejectUrl,
          entityId: leadSnapshot.id,
          leadId: publicLeadId,
          intentType,
        });
        if (emailResult.success && !emailResult.skipped && !emailResult.mocked) {
          const sms = getSMSProvider();
          await sms.sendSMS(
            leadSnapshot.customerMobile,
            `Goyal Hariyana Projects: ${leadSnapshot.cpName} invites you to confirm your interest in ${leadSnapshot.projectName}. Check your email for the confirmation link.`,
          );
        }
      } catch (e) {
        console.error("[Partner leads] confirmation notify failed:", e);
      }
    }

    let titanCrmId: string | undefined;
    try {
      const { punchPartnerLeadToCrm } = await import("@/lib/services/goyal-crm-sync");
      const crmResult = await punchPartnerLeadToCrm({
        leadDbId: leadSnapshot.id,
        customerName: leadSnapshot.customerName,
        customerEmail: leadSnapshot.customerEmail,
        customerMobile: leadSnapshot.customerMobile,
        projectName: leadSnapshot.projectName,
        city: leadSnapshot.city,
        fosName: leadSnapshot.fosName,
        notes: leadSnapshot.notes,
        intentType,
        publicLeadId,
      });
      titanCrmId = crmResult.crmId;
    } catch (e) {
      console.error("[Goyal CRM] deferred punch failed:", e);
    }

    try {
      const { publishEvent } = await import("@goyal/integration-hub");
      await publishEvent({
        type: "lead.created",
        entityId: leadSnapshot.id,
        payload: {
          leadId: publicLeadId,
          eoiCpLeadId: leadSnapshot.id,
          customerName: leadSnapshot.customerName,
          customerEmail: leadSnapshot.customerEmail,
          customerPhone: leadSnapshot.customerMobile,
          customerMobile: leadSnapshot.customerMobile,
          projectId: leadSnapshot.projectId,
          titanCrmId,
          cpId: leadSnapshot.cpId,
          intentType,
        },
      });
      await prisma.lead.update({
        where: { id: leadSnapshot.id },
        data: { bookingLeadId: publicLeadId },
      });
    } catch (e) {
      console.error("[Integration Hub] deferred lead.created failed:", e);
    }

    try {
      await writeAudit({
        actorId: session!.user.id,
        action: isLeadOnly
          ? "LEAD_ONLY_PUNCHED"
          : sendConfirmation
            ? "LEAD_CREATED_WITH_CONFIRMATION"
            : "LEAD_CREATED_DRAFT",
        entityType: "Lead",
        entityId: leadSnapshot.id,
        metadata: { customerEmail: leadSnapshot.customerEmail, projectId: leadSnapshot.projectId, intentType },
        ipAddress: getIpFromRequest(req),
      });
    } catch (e) {
      console.error("[Partner leads] deferred audit failed:", e);
    }
  });

  return apiResponse({
    lead: serializePartnerLead(lead, publicLeadId),
    intentType,
    // Optimistic: confirmation is queued; actual send happens in background.
    sentConfirmation: sendConfirmation,
    emailQueued: sendConfirmation,
    crmSynced: false,
    lockExpiresAt: lockExpiresAtIso,
    lockDaysRemaining,
    availableProjects: [],
    mappedProjects: [],
    ...(process.env.NODE_ENV !== "production" && sendConfirmation
      ? { devConfirmationLinks: { acceptUrl, rejectUrl } }
      : {}),
  }, 201);
}
