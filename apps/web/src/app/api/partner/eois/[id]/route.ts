import { prisma } from "@goyal/db";
import {
  withPartnerAuth,
  apiResponse,
  apiError,
  requireApprovedCP,
  withApiRoute,
} from "@/lib/api";
import { eoiScopeWhere } from "@/lib/partner-scope";

export const GET = withApiRoute("partner.eois.getOne", async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { error, session } = await withPartnerAuth();
  if (error) return error;
  const cpError = await requireApprovedCP(session!);
  if (cpError) return cpError;

  const { id } = await params;
  const eoi = await prisma.eOI.findFirst({
    where: { id, cpId: session!.user.cpId!, ...eoiScopeWhere(session!) },
    include: {
      lead: {
        select: {
          customerName: true,
          customerEmail: true,
          customerMobile: true,
          configuration: true,
          fosName: true,
        },
      },
      project: { select: { name: true } },
      documents: {
        where: { type: { in: ["EOI_DOCUMENT", "CHEQUE"] } },
        orderBy: { uploadedAt: "desc" },
      },
    },
  });
  if (!eoi) return apiError("EOI not found", 404);

  return apiResponse(eoi);
});
