import { prisma } from "@goyal/db";
import { withAuth, apiResponse, requireApprovedCP } from "@/lib/api";

export async function GET() {
  const { error, session } = await withAuth(["CHANNEL_PARTNER"]);
  if (error) return error;
  const cpError = await requireApprovedCP(session!);
  if (cpError) return cpError;

  const eois = await prisma.eOI.findMany({
    where: { cpId: session!.user.cpId! },
    include: {
      lead: { select: { customerName: true, customerEmail: true } },
      project: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return apiResponse(eois);
}
