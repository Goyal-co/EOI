import { prisma } from "@goyal/db";
import { withAuth, apiResponse } from "@/lib/api";

export async function GET(req: Request) {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const cpId = searchParams.get("cpId");
  const projectId = searchParams.get("projectId");
  const cheque = searchParams.get("cheque");

  const eois = await prisma.eOI.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(cpId ? { cpId } : {}),
      ...(projectId ? { projectId } : {}),
      ...(cheque === "uploaded" ? { chequeUploaded: true } : {}),
      ...(cheque === "missing" ? { chequeUploaded: false, status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } : {}),
    },
    include: {
      lead: { select: { customerName: true, customerEmail: true, journeyStatus: true } },
      project: { select: { name: true } },
      cp: { include: { user: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return apiResponse(eois.map((e) => ({
    id: e.id,
    referenceNumber: e.referenceNumber,
    status: e.status,
    journeyStatus: e.lead.journeyStatus,
    customerName: e.lead.customerName,
    customerEmail: e.lead.customerEmail,
    project: e.project.name,
    cpName: e.cp.user.name,
    chequeUploaded: e.chequeUploaded,
    chequeNumber: e.chequeNumber,
    submittedAt: e.submittedAt,
  })));
}
