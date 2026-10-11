import { prisma } from "@goyal/db";
import { partnerEoiDocumentSchema } from "@goyal/types";
import {
  withPartnerAuth,
  apiResponse,
  apiError,
  requireApprovedCP,
  withApiRoute,
} from "@/lib/api";
import { eoiScopeWhere } from "@/lib/partner-scope";
import { DocumentService } from "@/lib/services/document";

const EDITABLE = ["PENDING_SUBMISSION", "DRAFT", "CORRECTION_REQUESTED"] as const;

export const POST = withApiRoute("partner.eois.documents.create", async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { error, session } = await withPartnerAuth();
  if (error) return error;
  const cpError = await requireApprovedCP(session!);
  if (cpError) return cpError;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = partnerEoiDocumentSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0]?.message || "Invalid payload");

  const eoi = await prisma.eOI.findFirst({
    where: { id, cpId: session!.user.cpId!, ...eoiScopeWhere(session!) },
    select: { id: true, filledBy: true, status: true },
  });
  if (!eoi) return apiError("EOI not found", 404);
  if (eoi.filledBy !== "CP") {
    return apiError("Documents can only be uploaded for CP-filled EOIs", 400);
  }
  if (!EDITABLE.includes(eoi.status as (typeof EDITABLE)[number])) {
    return apiError("This EOI cannot be edited in its current status", 400);
  }

  const stored = await DocumentService.objectExists(parsed.data.fileUrl);
  if (!stored) {
    return apiError("Uploaded file not found in storage. Please upload again.", 400);
  }

  const mime =
    parsed.data.mimeType ||
    DocumentService.mimeTypeFromFileName(parsed.data.fileName) ||
    "application/octet-stream";
  const validationError = DocumentService.validateFile(
    parsed.data.type,
    mime,
    parsed.data.fileSize ?? 0,
  );
  if (validationError) return apiError(validationError);

  await prisma.document.deleteMany({
    where: { eoiId: eoi.id, type: parsed.data.type },
  });

  const doc = await prisma.document.create({
    data: {
      eoiId: eoi.id,
      cpId: session!.user.cpId!,
      type: parsed.data.type,
      fileName: parsed.data.fileName,
      fileUrl: parsed.data.fileUrl,
      fileSize: parsed.data.fileSize,
      mimeType: mime,
    },
  });

  if (parsed.data.type === "CHEQUE") {
    await prisma.eOI.update({
      where: { id: eoi.id },
      data: { chequeUploaded: true },
    });
  }

  return apiResponse(doc, 201);
});
