import { prisma } from "@goyal/db";
import { withAuth, apiError } from "@/lib/api";
import { rateLimitAsync, getClientIp } from "@/lib/rate-limit";

function escapeCsv(value: unknown): string {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: Request) {
  const ip = getClientIp(req);
  const limited = await rateLimitAsync(`export:${ip}`, 10, 60 * 60 * 1000);
  if (!limited.ok) return apiError("Too many export requests. Try again later.", 429);

  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "eois";
  const format = searchParams.get("format") || "csv";

  if (format !== "csv") return apiError("Only CSV export is supported", 400);

  if (type === "cps") {
    const cps = await prisma.channelPartner.findMany({
      include: {
        user: { select: { name: true, email: true } },
        _count: { select: { leads: true, eois: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const headers = ["Name", "Email", "Company", "RERA", "City", "Status", "Leads", "EOIs", "Registered"];
    const rows = cps.map((cp) => [
      cp.user.name,
      cp.user.email,
      cp.companyName,
      cp.reraNumber,
      cp.city,
      cp.status,
      cp._count.leads,
      cp._count.eois,
      cp.createdAt.toISOString(),
    ].map(escapeCsv).join(","));

    const csv = [headers.join(","), ...rows].join("\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="channel-partners-${Date.now()}.csv"`,
      },
    });
  }

  const eois = await prisma.eOI.findMany({
    where: { status: { not: "PENDING_SUBMISSION" } },
    include: {
      lead: { select: { customerName: true, customerEmail: true, journeyStatus: true } },
      project: { select: { name: true } },
      cp: { include: { user: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const headers = ["Reference", "Customer", "Email", "Project", "CP", "EOI Status", "Journey", "Cheque", "Submitted"];
  const rows = eois.map((e) => [
    e.referenceNumber,
    e.lead.customerName,
    e.lead.customerEmail,
    e.project.name,
    e.cp.user.name,
    e.status,
    e.lead.journeyStatus,
    e.chequeUploaded ? "Yes" : "No",
    e.submittedAt?.toISOString() || "",
  ].map(escapeCsv).join(","));

  const csv = [headers.join(","), ...rows].join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="eois-${Date.now()}.csv"`,
    },
  });
}
