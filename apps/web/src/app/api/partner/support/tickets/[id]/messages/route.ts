import { prisma } from "@goyal/db";
import { supportMessageCreateSchema } from "@goyal/types";
import { withPartnerAuth, apiResponse, apiError, requireApprovedCP, withApiRoute } from "@/lib/api";
import { notifyAdminsOfPartnerReply } from "@/lib/services/support";

export const POST = withApiRoute("partner.support.tickets.messages.create", async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { error, session } = await withPartnerAuth();
  if (error) return error;
  const cpError = await requireApprovedCP(session!);
  if (cpError) return cpError;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = supportMessageCreateSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0]?.message || "Invalid payload");

  const ticket = await prisma.supportTicket.findFirst({
    where: { id, cpId: session!.user.cpId! },
    select: { id: true, number: true, status: true, assignedAdminId: true },
  });
  if (!ticket) return apiError("Ticket not found", 404);
  if (ticket.status === "RESOLVED") {
    return apiError("This ticket is resolved. Start a new ticket if you need more help.", 400);
  }

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
        readByPartnerAt: now,
      },
    });
    await tx.supportTicket.update({
      where: { id: ticket.id },
      data: { lastMessageAt: now },
    });
    return msg;
  });

  await notifyAdminsOfPartnerReply({
    ticketId: ticket.id,
    ticketNumber: ticket.number,
    preview: parsed.data.body,
    assignedAdminId: ticket.assignedAdminId,
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
