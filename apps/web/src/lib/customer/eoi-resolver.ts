import { prisma } from "@goyal/db";

export async function resolveCustomerEoi(userId: string, email: string, eoiId?: string | null) {
  if (eoiId) {
    const eoi = await prisma.eOI.findFirst({
      where: { id: eoiId, customer: { userId } },
    });
    if (eoi) return eoi;
  }

  const eoi = await prisma.eOI.findFirst({
    where: { customer: { userId } },
    orderBy: { createdAt: "desc" },
  });
  if (eoi) return eoi;

  const lead = await prisma.lead.findFirst({
    where: { customerEmail: email, confirmationStatus: "ACCEPTED" },
    include: { eoi: true },
    orderBy: { createdAt: "desc" },
  });
  return lead?.eoi ?? null;
}

export async function customerOwnsProjectAsset(userId: string, projectId: string) {
  const eoi = await prisma.eOI.findFirst({
    where: { customer: { userId }, projectId },
  });
  return !!eoi;
}
