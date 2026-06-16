import { prisma } from "@goyal/db";
import { withAuth, apiResponse } from "@/lib/api";

export async function GET() {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;

  const cps = await prisma.channelPartner.findMany({
    include: {
      user: { select: { id: true, name: true, email: true, status: true } },
      _count: { select: { leads: true, eois: true } },
      eois: { where: { status: { in: ["APPROVED", "CLOSED"] } }, select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return apiResponse(cps.map((cp) => ({
    id: cp.id,
    name: cp.user.name,
    email: cp.user.email,
    companyName: cp.companyName,
    reraNumber: cp.reraNumber,
    mobile: cp.mobile || cp.user.email,
    registeredLeads: cp._count.leads,
    submittedEOIs: cp._count.eois,
    approvedEOIs: cp.eois.length,
    closures: cp.eois.length,
    status: cp.status,
    city: cp.city,
    createdAt: cp.createdAt,
  })));
}
