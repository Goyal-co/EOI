import { prisma } from "@goyal/db";
import { cpTeamMemberUpdateSchema } from "@goyal/types";
import { withAuth, apiResponse, apiError, requireApprovedCP, withApiRoute } from "@/lib/api";

async function getMemberForCp(id: string, cpId: string) {
  return prisma.cPTeamMember.findFirst({ where: { id, cpId } });
}

export const PATCH = withApiRoute("partner.team.update", async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { error, session } = await withAuth(["CHANNEL_PARTNER"]);
  if (error) return error;
  const cpError = await requireApprovedCP(session!);
  if (cpError) return cpError;

  const { id } = await params;
  const cpId = session!.user.cpId!;
  const existing = await getMemberForCp(id, cpId);
  if (!existing) return apiError("Team member not found", 404);

  const body = await req.json().catch(() => null);
  const parsed = cpTeamMemberUpdateSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0].message);

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

  return apiResponse(updated);
});

export const DELETE = withApiRoute("partner.team.delete", async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { error, session } = await withAuth(["CHANNEL_PARTNER"]);
  if (error) return error;
  const cpError = await requireApprovedCP(session!);
  if (cpError) return cpError;

  const { id } = await params;
  const cpId = session!.user.cpId!;
  const existing = await getMemberForCp(id, cpId);
  if (!existing) return apiError("Team member not found", 404);

  await prisma.cPTeamMember.update({
    where: { id },
    data: { status: "INACTIVE" },
  });

  return apiResponse({ ok: true });
});
