import { prisma } from "@goyal/db";
import { supportMessageCreateSchema } from "@goyal/types";
import { withAuth, apiResponse, apiError, withApiRoute } from "@/lib/api";
import { notifySupportMessage } from "@/lib/services/support";

export const POST = withApiRoute("admin.support.tickets.messages.create", async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { error, session } = await withAuth(["ADMIN"]);
  if (error) return error;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = supportMessageCreateSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0]?.message || "Invalid payload");

  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    include: { cp: { include: { user: { select: { id: true } } } } },
  });
  if (!ticket) return apiError("Ticket not found", 404);

  const now = new Date();
  const message = await prisma.$transaction(async (tx) => {
    const msg = await tx.supportMessage.create({
      data: {
        ticketId: ticket.id,
        senderUserId: session!.user.id,
        body: parsed.data.body,
        attachmentUrl: parsed.data.attachmentUrl || null,
        attachmentName: parsed.data.attachmentName || null,
        attachmentSize: parsed.data.attachmentSize || null,
        readByAdminAt: now,
      },
    });
    await tx.supportTicket.update({
      where: { id: ticket.id },
      data: {
        lastMessageAt: now,
        status: ticket.status === "RESOLVED" ? "IN_PROGRESS" : ticket.status === "OPEN" ? "IN_PROGRESS" : ticket.status,
        assignedAdminId: ticket.assignedAdminId || session!.user.id,
      },
    });
    return msg;
  });

  await notifySupportMessage({
    recipientUserId: ticket.cp.user.id,
    ticketId: ticket.id,
    ticketNumber: ticket.number,
    preview: parsed.data.body || (parsed.data.attachmentUrl ? "Photo" : ""),
    fromAdmin: true,
  });

  return apiResponse(
    {
      id: message.id,
      body: message.body,
      createdAt: message.createdAt,
      mine: true,
    },
    201,
  );
});
