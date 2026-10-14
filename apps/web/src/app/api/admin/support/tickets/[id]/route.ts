import { prisma } from "@goyal/db";
import { supportTicketUpdateSchema } from "@goyal/types";
import { withAuth, apiResponse, apiError, withApiRoute } from "@/lib/api";
import { supportCategoryLabel } from "@/lib/services/support";
import { writeAudit, getIpFromRequest } from "@/lib/services/audit";

export const GET = withApiRoute("admin.support.tickets.get", async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { error, session } = await withAuth(["ADMIN"]);
  if (error) return error;

  const { id } = await params;
  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    include: {
      cp: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      project: { select: { id: true, name: true } },
      assignedAdmin: { select: { id: true, name: true, email: true } },
      messages: {
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
      senderUserId: { not: session!.user.id },
      readByAdminAt: null,
    },
    data: { readByAdminAt: now },
  });

  return apiResponse({
    id: ticket.id,
    number: ticket.number,
    category: ticket.category,
    categoryLabel: supportCategoryLabel(ticket.category),
    status: ticket.status,
    priority: ticket.priority,
    source: ticket.source,
    createdAt: ticket.createdAt,
    lastMessageAt: ticket.lastMessageAt,
    assignedAdminId: ticket.assignedAdminId,
    assignedAdminName: ticket.assignedAdmin?.name || null,
    projectId: ticket.projectId,
    projectName: ticket.project?.name || null,
    partner: {
      id: ticket.cp.id,
      userId: ticket.cp.user.id,
      name: ticket.cp.user.name || "Partner",
      email: ticket.cp.user.email,
      companyName: ticket.cp.companyName,
      mobile: ticket.cp.mobile,
    },
    messages: ticket.messages.map((m) => ({
      id: m.id,
      body: m.body,
      createdAt: m.createdAt,
      attachmentUrl: m.attachmentUrl,
      attachmentName: m.attachmentName,
      attachmentSize: m.attachmentSize,
      mine: m.senderUserId === session!.user.id || m.sender.role === "ADMIN",
      senderName: m.sender.name || (m.sender.role === "ADMIN" ? "Support" : "Partner"),
      senderRole: m.sender.role,
    })),
  });
});

export const PATCH = withApiRoute("admin.support.tickets.patch", async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { error, session } = await withAuth(["ADMIN"]);
  if (error) return error;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = supportTicketUpdateSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0]?.message || "Invalid payload");

  const existing = await prisma.supportTicket.findUnique({ where: { id } });
  if (!existing) return apiError("Ticket not found", 404);

  let assignedAdminId = parsed.data.assignedAdminId;
  if (assignedAdminId === "self" || assignedAdminId === "__SELF__") {
    assignedAdminId = session!.user.id;
  }

  if (assignedAdminId) {
    const admin = await prisma.user.findFirst({
      where: { id: assignedAdminId, role: "ADMIN", status: "ACTIVE" },
    });
    if (!admin) return apiError("Assignee must be an active admin", 400);
  }

  if (parsed.data.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: parsed.data.projectId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!project) return apiError("Project not found or inactive", 400);
  }

  const updated = await prisma.supportTicket.update({
    where: { id },
    data: {
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.priority !== undefined ? { priority: parsed.data.priority } : {}),
      ...(parsed.data.assignedAdminId !== undefined ? { assignedAdminId } : {}),
      ...(parsed.data.projectId !== undefined ? { projectId: parsed.data.projectId } : {}),
    },
  });

  await writeAudit({
    actorId: session!.user.id,
    action: "SUPPORT_TICKET_UPDATED",
    entityType: "SupportTicket",
    entityId: id,
    metadata: { ...parsed.data, assignedAdminId },
    ipAddress: getIpFromRequest(req),
  });

  return apiResponse(updated);
});
