import { withAuth, apiResponse, apiError } from "@/lib/api";
import { prisma } from "@goyal/db";
import { decryptFormData } from "@/lib/services/form-data-pii";
import { writeAudit, getIpFromRequest } from "@/lib/services/audit";
import { rateLimitAsync, getClientIp } from "@/lib/rate-limit";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ip = getClientIp(req);
  const limited = await rateLimitAsync(`reveal-pii:${ip}`, 20, 60 * 60 * 1000);
  if (!limited.ok) return apiError("Too many requests. Try again later.", 429);

  const { error, session } = await withAuth(["ADMIN"]);
  if (error) return error;

  const { id } = await params;

  const eoi = await prisma.eOI.findUnique({
    where: { id },
    select: { id: true, formData: true, leadId: true },
  });

  if (!eoi) return apiError("EOI not found", 404);

  const rawFormData = (eoi.formData as Record<string, unknown>) || {};

  await writeAudit({
    actorId: session!.user.id,
    action: "PII_REVEALED",
    entityType: "EOI",
    entityId: id,
    metadata: { leadId: eoi.leadId },
    ipAddress: getIpFromRequest(req),
  });

  return apiResponse({
    formData: decryptFormData(rawFormData),
    piiMasked: false,
  });
}
