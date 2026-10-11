import { prisma } from "@goyal/db";
import { withAuth, apiResponse, withApiRoute } from "@/lib/api";

export const GET = withApiRoute("admin.eois.pending.get", async () => {
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

  return apiResponse(eois.map((e) => {
    const cheque = e.documents.find((d) => d.type === "CHEQUE");
    const eoiDocument = e.documents.find((d) => d.type === "EOI_DOCUMENT");
    return {
      id: e.id,
      customerName: e.lead.customerName,
      customerEmail: e.lead.customerEmail,
      customerMobile: e.lead.customerMobile,
      configuration: e.lead.configuration,
      fosName: e.lead.fosName,
      project: e.project.name,
      projectLocation: e.project.location,
      cpName: e.cp.user.name,
      status: e.status,
      filledBy: e.filledBy,
      referenceNumber: e.referenceNumber,
      journeyStatus: e.lead.journeyStatus,
      formData: e.formData,
      documents: e.documents,
      chequeNumber: e.chequeNumber,
      chequeUploaded: e.chequeUploaded,
      submittedAt: e.submittedAt,
      chequeDoc: cheque ? { id: cheque.id, fileUrl: cheque.fileUrl } : undefined,
      eoiDocument: eoiDocument
        ? { id: eoiDocument.id, fileUrl: eoiDocument.fileUrl, fileName: eoiDocument.fileName }
        : undefined,
    };
  }));
});
