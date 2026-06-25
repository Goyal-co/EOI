import { prisma } from "@goyal/db";
import { withAuth, apiResponse, requireApprovedCP } from "@/lib/api";

export async function GET(req: Request) {
  const { error, session } = await withAuth(["CHANNEL_PARTNER"]);
  if (error) return error;
  const cpError = await requireApprovedCP(session!);
  if (cpError) return cpError;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  let statusFilter: Record<string, unknown> = {};
  if (status === "submitted") {
    statusFilter = { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } };
  } else if (status) {
    statusFilter = { status: status as never };
  }

  const eois = await prisma.eOI.findMany({
    where: { cpId: session!.user.cpId!, ...statusFilter },
    include: {
      lead: { select: { customerName: true, customerEmail: true } },
      project: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return apiResponse(eois);
}
