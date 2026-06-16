import { prisma } from "@goyal/db";
import { leadPatchSchema } from "@goyal/types";
import { withAuth, apiResponse, apiError, requireApprovedCP } from "@/lib/api";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await withAuth(["CHANNEL_PARTNER"]);
  if (error) return error;
  const cpError = await requireApprovedCP(session!);
  if (cpError) return cpError;

  const { id } = await params;
  const body = await req.json();
  const parsed = leadPatchSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0].message);

  const lead = await prisma.lead.findFirst({
    where: { id, cpId: session!.user.cpId! },
  });
  if (!lead) return apiError("Lead not found", 404);

  const updated = await prisma.lead.update({
    where: { id },
    data: parsed.data,
  });

  return apiResponse(updated);
}
