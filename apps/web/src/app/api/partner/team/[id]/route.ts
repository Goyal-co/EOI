import { prisma } from "@goyal/db";
import { cpTeamMemberUpdateSchema } from "@goyal/types";
import {
  withPartnerAuth,
  apiResponse,
  apiError,
  requireApprovedCP,
  requirePartnerOwner,
  withApiRoute,
} from "@/lib/api";
import { syncTeamMemberLogin, TeamMemberAuthError } from "@/lib/services/team-member-auth";

async function getMemberForCp(id: string, cpId: string) {
  return prisma.cPTeamMember.findFirst({ where: { id, cpId } });
}

export const PATCH = withApiRoute("partner.team.update", async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { error, session } = await withPartnerAuth();
  if (error) return error;
  const cpError = await requireApprovedCP(session!);
  if (cpError) return cpError;
  const ownerError = await requirePartnerOwner(session!);
  if (ownerError) return ownerError;

  const { id } = await params;
  const cpId = session!.user.cpId!;
  const existing = await getMemberForCp(id, cpId);
  if (!existing) return apiError("Team member not found", 404);

  const body = await req.json().catch(() => null);
  const parsed = cpTeamMemberUpdateSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0].message);

  const nextName = parsed.data.name !== undefined ? parsed.data.name.trim() : existing.name;
  const nextEmail = parsed.data.email !== undefined ? (parsed.data.email?.trim() || null) : existing.email;

  const updated = await prisma.cPTeamMember.update({
    where: { id },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name.trim() } : {}),
      ...(parsed.data.email !== undefined ? { email: parsed.data.email?.trim() || null } : {}),
      ...(parsed.data.mobile !== undefined ? { mobile: parsed.data.mobile?.trim() || null } : {}),
      ...(parsed.data.role !== undefined ? { role: parsed.data.role?.trim() || null } : {}),
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
    },
  });

  let invited = false;
  if (parsed.data.email !== undefined || parsed.data.name !== undefined || parsed.data.status !== undefined) {
    try {
      const login = await syncTeamMemberLogin({
        cpId,
        teamMemberId: updated.id,
        name: nextName,
        email: nextEmail,
        previousEmail: existing.email,
      });
      invited = login.invited;
    } catch (e) {
      if (e instanceof TeamMemberAuthError) return apiError(e.message, 400);
      throw e;
    }
  }

  return apiResponse({ ...updated, invited });
});

export const DELETE = withApiRoute("partner.team.delete", async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { error, session } = await withPartnerAuth();
  if (error) return error;
  const cpError = await requireApprovedCP(session!);
  if (cpError) return cpError;
  const ownerError = await requirePartnerOwner(session!);
  if (ownerError) return ownerError;

  const { id } = await params;
  const cpId = session!.user.cpId!;
  const existing = await getMemberForCp(id, cpId);
  if (!existing) return apiError("Team member not found", 404);

  await prisma.cPTeamMember.update({
    where: { id },
    data: { status: "INACTIVE" },
  });

  if (existing.userId) {
    await prisma.user.update({
      where: { id: existing.userId },
      data: { status: "INACTIVE" },
    });
  }

  return apiResponse({ ok: true });
});
