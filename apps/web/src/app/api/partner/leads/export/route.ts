import { prisma } from "@goyal/db";
import { withPartnerAuth, apiError, requireApprovedCP, requirePartnerOwner, withApiRoute } from "@/lib/api";
import { getSystemSettings } from "@/lib/services/system-settings";
import { leadScopeWhere } from "@/lib/partner-scope";

function escapeCsv(value: unknown): string {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export const GET = withApiRoute("partner.leads.export.get", async () => {
  const { error, session } = await withPartnerAuth();
  if (error) return error;
  const cpError = await requireApprovedCP(session!);
  if (cpError) return cpError;

  const ownerError = await requirePartnerOwner(session!);
  if (ownerError) return ownerError;

  const settings = await getSystemSettings();
  if (!settings.permissions.cpCanExportLeads) {
    return apiError("Lead export is disabled for channel partners", 403);
  }

  const cpId = session!.user.cpId!;
  const leads = await prisma.lead.findMany({
    where: { cpId, ...leadScopeWhere(session!) },
    include: {
      project: { select: { name: true } },
      eoi: { select: { status: true, referenceNumber: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const headers = ["Customer", "Email", "Mobile", "Project", "Journey Status", "EOI Status", "Reference", "Created"];
  const rows = leads.map((l) => [
    l.customerName,
    l.customerEmail,
    l.customerMobile,
    l.project.name,
    l.journeyStatus,
    l.eoi?.status || "",
    l.eoi?.referenceNumber || "",
    l.createdAt.toISOString(),
  ].map(escapeCsv).join(","));

  const csv = [headers.join(","), ...rows].join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${Date.now()}.csv"`,
    },
  });
});
