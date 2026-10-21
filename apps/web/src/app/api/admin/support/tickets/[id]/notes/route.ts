import { prisma } from "@goyal/db";
import { supportNoteCreateSchema } from "@goyal/types";
import { withAuth, apiResponse, apiError, withApiRoute } from "@/lib/api";
import { sanitizeSupportPreview } from "@/lib/services/support";
import { writeAudit, getIpFromRequest } from "@/lib/services/audit";

export const POST = withApiRoute("admin.support.tickets.notes.create", async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { error, session } = await withAuth(["ADMIN"]);
  if (error) return error;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = supportNoteCreateSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0]?.message || "Invalid payload");

  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!ticket) return apiError("Ticket not found", 404);

  const now = new Date();
  const note = await prisma.supportMessage.create({
    data: {
      ticketId: ticket.id,
      senderUserId: session!.user.id,
      body: parsed.data.body,
      internal: true,
      readByAdminAt: now,
      readByPartnerAt: now,
    },
  });

  await writeAudit({
    actorId: session!.user.id,
    action: "SUPPORT_TICKET_NOTE",
    entityType: "SupportTicket",
    entityId: ticket.id,
    metadata: { preview: sanitizeSupportPreview(parsed.data.body, 140), messageId: note.id },
    ipAddress: getIpFromRequest(req),
  });

  return apiResponse({ id: note.id, body: note.body, createdAt: note.createdAt }, 201);
});
