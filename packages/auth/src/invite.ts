import { randomBytes } from "crypto";
import { prisma } from "@goyal/db";

export function generateInviteToken(): string {
  return randomBytes(32).toString("hex");
}

export async function validateInviteToken(token: string) {
  const lead = await prisma.lead.findUnique({
    where: { inviteToken: token },
    include: {
      project: true,
      cp: { include: { user: true } },
    },
  });

  if (!lead) return { valid: false, error: "Invalid invitation link" };

  if (lead.intentType === "LEAD_ONLY") {
    return { valid: false, error: "This project interest does not require an EOI invitation" };
  }

  if (lead.confirmationStatus !== "ACCEPTED") {
    if (lead.inviteExpiresAt && lead.inviteExpiresAt < new Date()) {
      return { valid: false, error: "Invitation has expired" };
    }
    return { valid: false, error: "Customer confirmation is required before proceeding" };
  }

  return { valid: true, lead };
}
