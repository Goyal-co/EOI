import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { prisma, isUniqueConstraintError } from "@goyal/db";
import { normalizeEmail } from "@goyal/types";
import {
  getPartnerResetPasswordUrl,
  passwordResetEmailHtml,
  rewriteEmailHtmlUrls,
  sendEmailWithLog,
  canonicalizeEmailUrl,
} from "@goyal/email";

export class TeamMemberAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TeamMemberAuthError";
  }
}

async function sendSetPasswordEmail(userId: string, email: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.passwordResetToken.deleteMany({ where: { userId } });
  await prisma.passwordResetToken.create({ data: { userId, token, expiresAt } });
  const resetUrl = canonicalizeEmailUrl(getPartnerResetPasswordUrl(token));
  await sendEmailWithLog({
    to: email,
    subject: "Set your partner portal password — Goyal & Co. | Hariyana Group",
    html: rewriteEmailHtmlUrls(passwordResetEmailHtml({ resetUrl })),
    type: "PASSWORD_RESET",
  });
}

/** Create or relink a login user for a roster team member. Sends set-password email for new accounts. */
export async function syncTeamMemberLogin(params: {
  cpId: string;
  teamMemberId: string;
  name: string;
  email?: string | null;
  previousEmail?: string | null;
}) {
  const email = params.email?.trim() ? normalizeEmail(params.email.trim()) : null;
  const previousEmail = params.previousEmail?.trim()
    ? normalizeEmail(params.previousEmail.trim())
    : null;

  const member = await prisma.cPTeamMember.findFirst({
    where: { id: params.teamMemberId, cpId: params.cpId },
    select: { id: true, userId: true, status: true },
  });
  if (!member) throw new TeamMemberAuthError("Team member not found");

  if (!email) {
    if (member.userId) {
      await prisma.user.update({
        where: { id: member.userId },
        data: { status: "INACTIVE" },
      });
      await prisma.cPTeamMember.update({
        where: { id: member.id },
        data: { userId: null },
      });
    }
    return { userId: null as string | null, invited: false };
  }

  if (member.status === "INACTIVE") {
    if (member.userId) {
      await prisma.user.update({
        where: { id: member.userId },
        data: { status: "INACTIVE" },
      });
    }
    return { userId: member.userId, invited: false };
  }

  const existingUser = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    include: { teamMemberProfile: true, cpProfile: true },
  });

  if (existingUser) {
    if (existingUser.role === "CHANNEL_PARTNER") {
      throw new TeamMemberAuthError("This email belongs to a channel partner account");
    }
    if (existingUser.role === "CUSTOMER" || existingUser.role === "ADMIN") {
      throw new TeamMemberAuthError("This email is already registered on another portal");
    }
    if (
      existingUser.role === "CP_TEAM_MEMBER"
      && existingUser.teamMemberProfile
      && existingUser.teamMemberProfile.id !== member.id
    ) {
      throw new TeamMemberAuthError("This email is already used by another team member");
    }

    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        name: params.name.trim(),
        status: "ACTIVE",
        role: "CP_TEAM_MEMBER",
      },
    });
    await prisma.cPTeamMember.update({
      where: { id: member.id },
      data: { userId: existingUser.id, email },
    });
    if (previousEmail && previousEmail !== email) {
      await sendSetPasswordEmail(existingUser.id, email);
      return { userId: existingUser.id, invited: true };
    }
    return { userId: existingUser.id, invited: false };
  }

  const tempPassword = randomBytes(24).toString("hex");
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  try {
    const user = await prisma.user.create({
      data: {
        email,
        name: params.name.trim(),
        passwordHash,
        role: "CP_TEAM_MEMBER",
        status: "ACTIVE",
      },
    });
    await prisma.cPTeamMember.update({
      where: { id: member.id },
      data: { userId: user.id, email },
    });
    await sendSetPasswordEmail(user.id, email);
    return { userId: user.id, invited: true };
  } catch (error) {
    if (isUniqueConstraintError(error, "email")) {
      throw new TeamMemberAuthError("This email is already registered");
    }
    throw error;
  }
}
