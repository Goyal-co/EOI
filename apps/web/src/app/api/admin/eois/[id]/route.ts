import { prisma } from "@goyal/db";
import { withAuth, apiResponse, apiError } from "@/lib/api";
import { maskFormData } from "@/lib/services/form-data-pii";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;

  const { id } = await params;

  const eoi = await prisma.eOI.findUnique({
    where: { id },
    include: {
      lead: true,
      project: { select: { name: true, location: true } },
      cp: { include: { user: { select: { name: true, email: true } } } },
      documents: true,
      approvalActions: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });

  if (!eoi) return apiError("EOI not found", 404);

  const rawFormData = (eoi.formData as Record<string, unknown>) || {};

  return apiResponse({
    id: eoi.id,
    referenceNumber: eoi.referenceNumber,
    status: eoi.status,
    journeyStatus: eoi.lead.journeyStatus,
    customerName: eoi.lead.customerName,
    customerEmail: eoi.lead.customerEmail,
    customerMobile: eoi.lead.customerMobile,
    project: eoi.project.name,
    projectLocation: eoi.project.location,
    cpName: eoi.cp.user.name,
    cpEmail: eoi.cp.user.email,
    formData: maskFormData(rawFormData),
    piiMasked: true,
    documents: eoi.documents,
    chequeNumber: eoi.chequeNumber,
    chequeUploaded: eoi.chequeUploaded,
    submittedAt: eoi.submittedAt,
    chequeDoc: eoi.documents.find((d) => d.type === "CHEQUE"),
    approvalActions: eoi.approvalActions,
  });
}
