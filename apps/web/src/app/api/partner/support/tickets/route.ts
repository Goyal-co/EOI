import { prisma } from "@goyal/db";
import { supportTicketCreateSchema, SUPPORT_CATEGORY_LABELS } from "@goyal/types";
import { withPartnerAuth, apiResponse, apiError, requireApprovedCP, withApiRoute } from "@/lib/api";
import {
  createSupportTicketWithRetry,
  notifyAdminsSupportTicketCreated,
  supportCategoryLabel,
} from "@/lib/services/support";

export const GET = withApiRoute("partner.support.tickets.list", async () => {
  const { error, session } = await withPartnerAuth();
  if (error) return error;
  const cpError = await requireApprovedCP(session!);
  if (cpError) return cpError;

  const cpId = session!.user.cpId!;
  const tickets = await prisma.supportTicket.findMany({
    where: { cpId },
    include: {
      messages: {
        where: { internal: false },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      project: { select: { id: true, name: true } },
      _count: {
        select: {
          messages: {
            where: {
              readByPartnerAt: null,
              internal: false,
              sender: { role: "ADMIN" },
            },
          },
        },
      },
    },
    orderBy: { lastMessageAt: "desc" },
    take: 100,
  });

  return apiResponse(
    tickets.map((t) => {
      const last = t.messages[0];
      return {
        id: t.id,
        number: t.number,
        category: t.category,
        categoryLabel: supportCategoryLabel(t.category),
        status: t.status,
        priority: t.priority,
        lastMessageAt: t.lastMessageAt,
        createdAt: t.createdAt,
        projectName: t.project?.name || null,
        lastMessagePreview: (last?.body || (last?.attachmentUrl ? "Photo" : "")).slice(0, 140),
        unreadCount: t._count.messages,
      };
    }),
  );
});

export const POST = withApiRoute("partner.support.tickets.create", async (req: Request) => {
  const { error, session } = await withPartnerAuth();
  if (error) return error;
  const cpError = await requireApprovedCP(session!);
  if (cpError) return cpError;

  const body = await req.json().catch(() => null);
  const parsed = supportTicketCreateSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0]?.message || "Invalid payload");

  const cpId = session!.user.cpId!;
  const cp = await prisma.channelPartner.findUnique({
    where: { id: cpId },
    include: { user: { select: { id: true, name: true } } },
  });
  if (!cp) return apiError("Partner not found", 404);

  if (parsed.data.projectId) {
    const access = await prisma.cPProjectAccess.findUnique({
      where: { cpId_projectId: { cpId, projectId: parsed.data.projectId } },
    });
    if (!access) return apiError("Project not assigned to this partner", 400);
  }

  const ticket = await createSupportTicketWithRetry({
    cpId,
    category: parsed.data.category,
    projectId: parsed.data.projectId,
    senderUserId: session!.user.id,
    message: parsed.data.message,
    attachmentUrl: parsed.data.attachmentUrl,
    attachmentName: parsed.data.attachmentName,
    attachmentSize: parsed.data.attachmentSize,
  });

  await notifyAdminsSupportTicketCreated({
    ticketId: ticket.id,
    ticketNumber: ticket.number,
    category: ticket.category,
    partnerName: cp.user.name || "Partner",
  });

  return apiResponse(
    {
      id: ticket.id,
      number: ticket.number,
      category: ticket.category,
      categoryLabel: SUPPORT_CATEGORY_LABELS[ticket.category],
      status: ticket.status,
    },
    201,
  );
});
