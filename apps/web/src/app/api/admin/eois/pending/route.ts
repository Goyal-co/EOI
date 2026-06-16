import { prisma } from "@goyal/db";
import { withAuth, apiResponse } from "@/lib/api";

export async function GET() {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;

  const eois = await prisma.eOI.findMany({
    where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
    include: {
      lead: true,
      project: { select: { name: true, location: true } },
      cp: { include: { user: { select: { name: true } } } },
      documents: true,
    },
    orderBy: { submittedAt: "desc" },
  });

  return apiResponse(eois.map((e) => ({
    id: e.id,
    customerName: e.lead.customerName,
    customerEmail: e.lead.customerEmail,
    customerMobile: e.lead.customerMobile,
    project: e.project.name,
    projectLocation: e.project.location,
    cpName: e.cp.user.name,
    status: e.status,
    referenceNumber: e.referenceNumber,
    journeyStatus: e.lead.journeyStatus,
    formData: e.formData,
    documents: e.documents,
    chequeNumber: e.chequeNumber,
    chequeUploaded: e.chequeUploaded,
    submittedAt: e.submittedAt,
    chequeDoc: e.documents.find((d) => d.type === "CHEQUE")
      ? { id: e.documents.find((d) => d.type === "CHEQUE")!.id, fileUrl: e.documents.find((d) => d.type === "CHEQUE")!.fileUrl }
      : undefined,
  })));
}
