import { prisma, type LeadEventType, type Prisma } from "@goyal/db";
import { generatePublicLeadId } from "@/lib/leads/id-generator";
import { normalizeMobile } from "@/lib/leads/phone";

type Tx = Prisma.TransactionClient | typeof prisma;

export async function findLeadIdentityByContact(mobile: string, email: string, tx: Tx = prisma) {
  const phone = normalizeMobile(mobile);
  const emailLower = email.trim().toLowerCase();
  return tx.leadIdentity.findFirst({
    where: {
      OR: [
        { primaryPhone: phone },
        { primaryEmail: { equals: emailLower, mode: "insensitive" } },
        {
          leads: {
            some: {
              OR: [
                { customerMobile: phone },
                { customerEmail: { equals: emailLower, mode: "insensitive" } },
              ],
            },
          },
        },
      ],
    },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Resolve an existing identity or create one with a new public leadId.
 * Reuses earliest matching public leadId from Lead rows when present.
 */
export async function resolveOrCreateLeadIdentity(params: {
  mobile: string;
  email: string;
  intentType: "EOI" | "LEAD_ONLY";
  projectName: string;
  tx?: Tx;
}): Promise<{ identityId: string; publicLeadId: string; created: boolean }> {
  const client = params.tx ?? prisma;
  const phone = normalizeMobile(params.mobile);
  const emailLower = params.email.trim().toLowerCase();

  const existing = await findLeadIdentityByContact(phone, emailLower, client);
  if (existing) {
    return {
      identityId: existing.id,
      publicLeadId: existing.leadId,
      created: false,
    };
  }

  const legacyLead = await client.lead.findFirst({
    where: {
      leadId: { not: null },
      OR: [
        { customerMobile: phone },
        { customerEmail: { equals: emailLower, mode: "insensitive" } },
      ],
    },
    orderBy: { createdAt: "asc" },
    select: { leadId: true },
  });

  let publicLeadId = legacyLead?.leadId || null;
  if (!publicLeadId) {
    const latestForSeq = await client.lead.findFirst({
      where: { leadId: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { leadId: true },
    });
    let seq = Date.now() % 1_000_000;
    if (latestForSeq?.leadId) {
      const match = latestForSeq.leadId.match(/(\d+)$/);
      if (match) seq = (Number(match[1]) % 1_000_000) + 1;
    }
    publicLeadId = generatePublicLeadId(params.intentType, params.projectName, seq);
  }

  const created = await client.leadIdentity.create({
    data: {
      leadId: publicLeadId,
      primaryPhone: phone,
      primaryEmail: emailLower,
    },
  });

  return {
    identityId: created.id,
    publicLeadId: created.leadId,
    created: true,
  };
}

export async function recordLeadEvent(params: {
  identityId: string;
  type: LeadEventType;
  leadId?: string | null;
  cpId?: string | null;
  projectId?: string | null;
  actorType?: string | null;
  metadata?: Record<string, unknown>;
  occurredAt?: Date;
  tx?: Tx;
}) {
  const client = params.tx ?? prisma;
  return client.leadEvent.create({
    data: {
      identityId: params.identityId,
      type: params.type,
      leadId: params.leadId || null,
      cpId: params.cpId || null,
      projectId: params.projectId || null,
      actorType: params.actorType || null,
      metadata: (params.metadata || undefined) as Prisma.InputJsonValue | undefined,
      occurredAt: params.occurredAt || new Date(),
    },
  });
}
