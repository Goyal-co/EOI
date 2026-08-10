import { z } from "zod";
import { prisma } from "@goyal/db";
import { withAuth, apiResponse, apiError, requireApprovedCP } from "@/lib/api";
import {
  evaluateIdentityLock,
  getIdentityPunchContext,
  resolvePartnerLockState,
} from "@/lib/leads/identity-context";
import { normalizeMobile } from "@/lib/leads/phone";
import { writeAudit, getIpFromRequest } from "@/lib/services/audit";

const activateSchema = z.object({
  leadId: z.string().min(1),
});

/**
 * Validate that this CP may re-activate an expired identity and return
 * punch-context so the UI can open the punch/map modal prefilled.
 */
export async function POST(req: Request) {
  const { error, session } = await withAuth(["CHANNEL_PARTNER"]);
  if (error) return error;
  const cpError = await requireApprovedCP(session!);
  if (cpError) return cpError;

  const body = await req.json().catch(() => null);
  const parsed = activateSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0].message);

  const cpId = session!.user.cpId!;
  const lead = await prisma.lead.findFirst({
    where: { id: parsed.data.leadId, cpId },
    select: {
      id: true,
      leadId: true,
      customerName: true,
      customerMobile: true,
      customerEmail: true,
      projectId: true,
    },
  });
  if (!lead) return apiError("Lead not found", 404);

  const mobile = normalizeMobile(lead.customerMobile);
  const email = lead.customerEmail.trim().toLowerCase();

  const lock = await resolvePartnerLockState({ cpId, mobile, email });
  if (!lock.canActivate) {
    if (lock.lockStatus === "COOLDOWN") {
      return apiError(
        `You cannot reactivate this lead for ${lock.cooldownDaysRemaining} more day${
          lock.cooldownDaysRemaining === 1 ? "" : "s"
        } (7-day prior-CP cooldown).`,
        409,
        "PRIOR_CP_COOLDOWN",
      );
    }
    if (lock.lockStatus === "ACTIVE") {
      return apiError("This lead is already under an active lock.", 409, "IDENTITY_LOCKED");
    }
    return apiError(
      "This lead cannot be activated right now. Another CP may hold the lock.",
      409,
      "IDENTITY_LOCKED",
    );
  }

  const lockEval = await evaluateIdentityLock({ cpId, mobile, email });
  if (!lockEval.ok) {
    return apiError(lockEval.message, 409, lockEval.code);
  }

  const punchContext = await getIdentityPunchContext(cpId, mobile, email);

  await writeAudit({
    actorId: session!.user.id,
    action: "LEAD_ACTIVATE_REQUESTED",
    entityType: "Lead",
    entityId: lead.id,
    metadata: {
      publicLeadId: lead.leadId,
      mobile,
      email,
      availableProjects: punchContext.availableProjects.length,
    },
    ipAddress: getIpFromRequest(req),
  });

  return apiResponse({
    ok: true,
    leadId: lead.id,
    publicLeadId: lead.leadId || punchContext.publicLeadId,
    customerName: lead.customerName,
    customerMobile: mobile,
    customerEmail: email,
    availableProjects: punchContext.availableProjects,
    mappedProjects: punchContext.mappedProjects,
    lockExpiresAt: punchContext.lockExpiresAt,
    lockDaysRemaining: punchContext.lockDaysRemaining,
  });
}
