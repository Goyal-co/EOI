import { prisma, isUniqueConstraintError } from "@goyal/db";
import { SUPPORT_CATEGORY_LABELS, type SupportTicketCategory } from "@goyal/types";
import { NotificationService } from "@goyal/email";

export function supportCategoryLabel(category: string): string {
  return SUPPORT_CATEGORY_LABELS[category as SupportTicketCategory] || category;
}

export function sanitizeSupportPreview(text: string, max = 120): string {
  return text.replace(/\s+/g, " ").trim().slice(0, max);
}

export async function generateSupportTicketNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `SUP-${year}-`;
  const latest = await prisma.supportTicket.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  let seq = 1;
  if (latest?.number) {
    const part = latest.number.slice(prefix.length);
    const n = Number.parseInt(part, 10);
    if (Number.isFinite(n)) seq = n + 1;
  }
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

/** Create ticket with retry on rare number collisions. */
export async function createSupportTicketWithRetry(params: {
  cpId: string;
  category: SupportTicketCategory;
  projectId?: string | null;
  senderUserId: string;
  message: string;
}): Promise<{ id: string; number: string; category: SupportTicketCategory; status: string }> {
  const now = new Date();
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    const number = await generateSupportTicketNumber();
    try {
      return await prisma.supportTicket.create({
        data: {
          number,
          cpId: params.cpId,
          category: params.category,
          priority: "MEDIUM",
          projectId: params.projectId || null,
          lastMessageAt: now,
          messages: {
            create: {
              senderUserId: params.senderUserId,
              body: params.message,
              readByPartnerAt: now,
            },
          },
        },
        select: { id: true, number: true, category: true, status: true },
      });
    } catch (e) {
      lastError = e;
      if (isUniqueConstraintError(e, "number")) continue;
      throw e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Failed to allocate ticket number");
}

export async function notifyAdminsSupportTicketCreated(params: {
  ticketId: string;
  ticketNumber: string;
  category: string;
  partnerName: string;
}) {
  // Cap fan-out to avoid notification storms on large admin fleets.
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", status: "ACTIVE" },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: 25,
  });
  const preview = sanitizeSupportPreview(
    `${params.partnerName} opened ${params.ticketNumber} (${supportCategoryLabel(params.category)})`,
    180,
  );
  await Promise.all(
    admins.map((admin) =>
      NotificationService.emit({
        userId: admin.id,
        type: "SUPPORT_TICKET_CREATED",
        title: "New support ticket",
        body: preview,
        entityType: "SupportTicket",
        entityId: params.ticketId,
      }),
    ),
  );
}

export async function notifySupportMessage(params: {
  recipientUserId: string;
  ticketId: string;
  ticketNumber: string;
  preview: string;
  fromAdmin: boolean;
}) {
  await NotificationService.emit({
    userId: params.recipientUserId,
    type: "SUPPORT_MESSAGE",
    title: params.fromAdmin ? "Support reply" : "Support ticket update",
    body: `${params.ticketNumber}: ${sanitizeSupportPreview(params.preview)}`,
    entityType: "SupportTicket",
    entityId: params.ticketId,
  });
}

/** Notify assignee only; if unassigned, notify a small admin pool once. */
export async function notifyAdminsOfPartnerReply(params: {
  ticketId: string;
  ticketNumber: string;
  preview: string;
  assignedAdminId: string | null;
}) {
  if (params.assignedAdminId) {
    await notifySupportMessage({
      recipientUserId: params.assignedAdminId,
      ticketId: params.ticketId,
      ticketNumber: params.ticketNumber,
      preview: params.preview,
      fromAdmin: false,
    });
    return;
  }
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", status: "ACTIVE" },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: 10,
  });
  await Promise.all(
    admins.map((admin) =>
      notifySupportMessage({
        recipientUserId: admin.id,
        ticketId: params.ticketId,
        ticketNumber: params.ticketNumber,
        preview: params.preview,
        fromAdmin: false,
      }),
    ),
  );
}

export function mapTicketListItem(ticket: {
  id: string;
  number: string;
  category: string;
  status: string;
  priority: string;
  source: string;
  lastMessageAt: Date;
  createdAt: Date;
  assignedAdminId: string | null;
  projectId: string | null;
  project?: { id: string; name: string } | null;
  assignedAdmin?: { id: string; name: string | null } | null;
  cp: {
    id: string;
    companyName: string | null;
    mobile: string | null;
    user: { id: string; name: string | null; email: string };
  };
  messages: Array<{
    id: string;
    body: string;
    createdAt: Date;
    senderUserId: string;
    readByAdminAt: Date | null;
    readByPartnerAt: Date | null;
    sender?: { role?: string } | null;
  }>;
  _count?: { messages: number };
}) {
  const last = ticket.messages[0];
  const unreadForAdmin = ticket.messages.filter((m) => {
    if (m.readByAdminAt) return false;
    const role = m.sender?.role;
    if (role === "CHANNEL_PARTNER" || role === "CP_TEAM_MEMBER") return true;
    if (!role && m.senderUserId === ticket.cp.user.id) return true;
    return false;
  }).length;
  return {
    id: ticket.id,
    number: ticket.number,
    category: ticket.category,
    categoryLabel: supportCategoryLabel(ticket.category),
    status: ticket.status,
    priority: ticket.priority,
    source: ticket.source,
    lastMessageAt: ticket.lastMessageAt,
    createdAt: ticket.createdAt,
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
    lastMessagePreview: last?.body?.slice(0, 140) || "",
    unreadCount: unreadForAdmin,
  };
}
