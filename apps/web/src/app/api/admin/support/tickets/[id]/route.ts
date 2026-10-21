import { prisma } from "@goyal/db";
import { supportTicketUpdateSchema } from "@goyal/types";
import { withAuth, apiResponse, apiError, withApiRoute } from "@/lib/api";
import { notifySupportTransfer, supportCategoryLabel } from "@/lib/services/support";
import { writeAudit, getIpFromRequest } from "@/lib/services/audit";

function historyLabel(action: string, metadata: unknown): { label: string; detail?: string } {
  const meta = metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : {};
  if (action === "SUPPORT_TICKET_NOTE") {
    return { label: "Internal note", detail: typeof meta.preview === "string" ? meta.preview : undefined };
  }
  if (action === "SUPPORT_TICKET_UPDATED") {
    const parts: string[] = [];
    if (typeof meta.status === "string") parts.push(`Status → ${meta.status.replace(/_/g, " ")}`);
    if (typeof meta.priority === "string") parts.push(`Priority → ${meta.priority}`);
    if ("assignedAdminId" in meta) {
      if (!meta.assignedAdminId) parts.push("Unassigned");
      else if (typeof meta.assignedAdminName === "string" && meta.assignedAdminName) {
        parts.push(`Transferred to ${meta.assignedAdminName}`);
      } else parts.push("Transferred");
    }
    if (typeof meta.projectId === "string") parts.push("Project updated");
    return { label: parts.join(" · ") || "Ticket updated" };
  }
  return { label: action.replace(/_/g, " ") };
}

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
      internal: false,
    },
    data: { readByAdminAt: now },
  });

  const logs = await prisma.auditLog.findMany({
    where: { entityType: "SupportTicket", entityId: ticket.id },
    orderBy: { createdAt: "desc" },
    take: 40,
    include: { actor: { select: { name: true } } },
  });

  const publicMessages = ticket.messages.filter((m) => !m.internal);
  const notes = ticket.messages.filter((m) => m.internal);

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
    messages: publicMessages.map((m) => ({
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
    notes: notes.map((m) => ({
      id: m.id,
      body: m.body,
      createdAt: m.createdAt,
      senderName: m.sender.name || "Admin",
    })),
    history: [
      {
        id: "opened",
        at: ticket.createdAt,
        actor: ticket.cp.user.name || "Partner",
        label: "Ticket opened",
        detail: supportCategoryLabel(ticket.category),
      },
      ...logs.map((log) => {
        const described = historyLabel(log.action, log.metadata);
        return {
          id: log.id,
          at: log.createdAt,
          actor: log.actor?.name || "Admin",
          label: described.label,
          detail: described.detail || null,
        };
      }),
    ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
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

  let assigneeName: string | null = null;
  if (assignedAdminId) {
    const admin = await prisma.user.findFirst({
      where: { id: assignedAdminId, role: "ADMIN", status: "ACTIVE" },
      select: { id: true, name: true },
    });
    if (!admin) return apiError("Assignee must be an active admin", 400);
    assigneeName = admin.name || "Admin";
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
    metadata: {
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.priority !== undefined ? { priority: parsed.data.priority } : {}),
      ...(parsed.data.assignedAdminId !== undefined ? { assignedAdminId, assignedAdminName: assigneeName } : {}),
      ...(parsed.data.projectId !== undefined ? { projectId: parsed.data.projectId } : {}),
    },
    ipAddress: getIpFromRequest(req),
  });

  if (
    parsed.data.assignedAdminId !== undefined &&
    assignedAdminId &&
    assignedAdminId !== existing.assignedAdminId &&
    assignedAdminId !== session!.user.id
  ) {
    await notifySupportTransfer({
      recipientUserId: assignedAdminId,
      ticketId: id,
      ticketNumber: existing.number,
    });
  }

  return apiResponse(updated);
});
