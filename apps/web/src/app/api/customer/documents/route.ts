import { prisma } from "@goyal/db";
import { documentUploadSchema } from "@goyal/types";
import { withAuth, apiResponse, apiError } from "@/lib/api";
import { DocumentService } from "@/lib/services/document";
import { writeAudit, getIpFromRequest } from "@/lib/services/audit";
import { resolveCustomerEoi } from "@/lib/customer/eoi-resolver";

export async function GET(req: Request) {
  const { error, session } = await withAuth(["CUSTOMER"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const eoiId = searchParams.get("eoiId");

  const eoi = await resolveCustomerEoi(session!.user.id, session!.user.email!, eoiId);
  if (!eoi) return apiResponse([]);

  const documents = await DocumentService.getDocumentsByEOI(eoi.id);
  return apiResponse(documents);
}

export async function POST(req: Request) {
  const { error, session } = await withAuth(["CUSTOMER"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const eoiId = searchParams.get("eoiId");

  const eoi = await resolveCustomerEoi(session!.user.id, session!.user.email!, eoiId);
  if (!eoi) return apiError("No EOI found", 404);

  const body = await req.json();
  const parsed = documentUploadSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0].message);

  const exists = await DocumentService.objectExists(parsed.data.fileUrl);
  if (!exists) return apiError("Uploaded file not found. Please upload again.", 400);

  const existing = await prisma.document.findFirst({
    where: { eoiId: eoi.id, type: parsed.data.type },
  });
  if (existing) {
    await DocumentService.deleteDocument(existing.id);
  }

  const doc = await DocumentService.saveDocument({
    ...parsed.data,
    eoiId: eoi.id,
  });

  await writeAudit({
    actorId: session!.user.id,
    action: "DOCUMENT_UPLOADED",
    entityType: "Document",
    entityId: doc.id,
    metadata: { type: parsed.data.type, eoiId: eoi.id },
    ipAddress: getIpFromRequest(req),
  });
  return apiResponse(doc, 201);
}
