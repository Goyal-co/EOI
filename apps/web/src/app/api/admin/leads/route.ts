import { prisma } from "@goyal/db";
import { withAuth, apiResponse } from "@/lib/api";

export async function GET(req: Request) {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const status = searchParams.get("status");
  const cpId = searchParams.get("cpId");
  const intentType = searchParams.get("intentType");

  const leads = await prisma.lead.findMany({
    where: {
      ...(projectId ? { projectId } : {}),
      ...(status ? { journeyStatus: status as never } : {}),
      ...(cpId ? { cpId } : {}),
      ...(intentType === "EOI" || intentType === "LEAD_ONLY"
        ? { intentType: intentType as "EOI" | "LEAD_ONLY" }
        : {}),
    },
    include: {
      project: { select: { name: true } },
      cp: { include: { user: { select: { name: true } } } },
      eoi: { select: { status: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return apiResponse(leads.map((l) => ({
    id: l.id,
    customerName: l.customerName,
    mobile: l.customerMobile,
    email: l.customerEmail,
    project: l.project.name,
    cpName: l.cp.user.name,
    siteVisitStatus: l.siteVisitStatus,
    journeyStatus: l.journeyStatus,
    leadStatus: l.journeyStatus,
    intentType: l.intentType,
    eoiStatus: l.eoi?.status || "N/A",
    dateAdded: l.createdAt,
  })));
}
