import { prisma } from "@goyal/db";
import { withPartnerAuth, apiResponse, apiError, requireApprovedCP, withApiRoute } from "@/lib/api";
import { supportCategoryLabel } from "@/lib/services/support";

export const GET = withApiRoute("partner.support.tickets.get", async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { error, session } = await withPartnerAuth();
  if (error) return error;
  const cpError = await requireApprovedCP(session!);
  if (cpError) return cpError;

  const { id } = await params;
  const ticket = await prisma.supportTicket.findFirst({
    where: { id, cpId: session!.user.cpId! },
    include: {
      project: { select: { id: true, name: true } },
      messages: {
        where: { internal: false },
        orderBy: { createdAt: "asc" },
        include: { sender: { select: { id: true, name: true, role: true } } },
      },
    },
  });
  if (!ticket) return apiError("Ticket not found", 404);

  const now = new Date();
  await prisma.supportMessage.updateMany({
    where: {
      ticketId: ticket.id,
      readByPartnerAt: null,
      internal: false,
      sender: { role: "ADMIN" },
    },
    data: { readByPartnerAt: now },
  });

  return apiResponse({
    id: ticket.id,
    number: ticket.number,
    category: ticket.category,
    categoryLabel: supportCategoryLabel(ticket.category),
    status: ticket.status,
    priority: ticket.priority,
    projectId: ticket.projectId,
    projectName: ticket.project?.name || null,
    createdAt: ticket.createdAt,
    lastMessageAt: ticket.lastMessageAt,
    messages: ticket.messages.map((m) => ({
      id: m.id,
      body: m.body,
      createdAt: m.createdAt,
      attachmentUrl: m.attachmentUrl,
      attachmentName: m.attachmentName,
      attachmentSize: m.attachmentSize,
      mine: m.senderUserId === session!.user.id,
      senderName: m.sender.name || (m.sender.role === "ADMIN" ? "Support" : "You"),
      senderRole: m.sender.role,
    })),
  });
});
