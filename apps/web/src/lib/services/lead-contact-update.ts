import { prisma } from "@goyal/db";
import { normalizeEmail } from "@goyal/types";
import { normalizeMobile } from "@/lib/leads/phone";

export async function updateLeadCustomerContact(params: {
  leadId: string;
  cpId: string;
  email?: string;
  mobile?: string;
}) {
  const lead = await prisma.lead.findFirst({
    where: { id: params.leadId, cpId: params.cpId },
    select: {
      id: true,
      projectId: true,
      customerEmail: true,
      customerMobile: true,
      identityId: true,
      journeyStatus: true,
      confirmationStatus: true,
    },
  });
  if (!lead) {
    throw new Error("Lead not found");
  }

  if (lead.journeyStatus === "BOOKED") {
    throw new Error("Cannot change contact details after booking");
  }

  const nextEmail = params.email !== undefined
    ? normalizeEmail(params.email)
    : lead.customerEmail;
  const nextMobile = params.mobile !== undefined
    ? normalizeMobile(params.mobile)
    : lead.customerMobile;

  if (nextEmail === lead.customerEmail && nextMobile === lead.customerMobile) {
    return prisma.lead.findFirstOrThrow({ where: { id: lead.id } });
  }

  const duplicate = await prisma.lead.findFirst({
    where: {
      cpId: params.cpId,
      projectId: lead.projectId,
      id: { not: lead.id },
      journeyStatus: { not: "REJECTED" },
      OR: [
        { customerMobile: nextMobile },
        { customerEmail: { equals: nextEmail, mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new Error("Another lead for this project already uses that email or mobile");
  }

  const updated = await prisma.lead.update({
    where: { id: lead.id },
    data: {
      customerEmail: nextEmail,
      customerMobile: nextMobile,
    },
  });

  if (lead.identityId) {
    await prisma.leadIdentity.update({
      where: { id: lead.identityId },
      data: {
        primaryEmail: nextEmail,
        primaryPhone: nextMobile,
      },
    });
  }

  return updated;
}
