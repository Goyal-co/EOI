import { prisma } from "@goyal/db";
import {
  withPartnerAuth,
  apiResponse,
  apiError,
  requireApprovedCP,
  withApiRoute,
} from "@/lib/api";
import { eoiScopeWhere } from "@/lib/partner-scope";
import { EOIEngine } from "@/lib/services/eoi-engine";

export const POST = withApiRoute("partner.eois.resubmit", async (
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
    include: { documents: { select: { type: true } } },
  });
  if (!eoi) return apiError("EOI not found", 404);
  if (eoi.filledBy !== "CP") {
    return apiError("Only CP-filled EOIs can be resubmitted from the partner portal", 400);
  }
  if (eoi.status !== "CORRECTION_REQUESTED") {
    return apiError("EOI is not awaiting correction", 400);
  }

  const types = new Set(eoi.documents.map((d) => d.type));
  if (!types.has("EOI_DOCUMENT") || !types.has("CHEQUE")) {
    return apiError("EOI document and cancelled cheque are required before resubmit", 400);
  }

  const updated = await EOIEngine.transition({
    eoiId: eoi.id,
    toStatus: "SUBMITTED",
    actorId: session!.user.id,
    chequeUploaded: true,
    expectedStatus: "CORRECTION_REQUESTED",
  });

  return apiResponse(updated);
});
