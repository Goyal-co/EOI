import { prisma, type AnnouncementAudience, type AnnouncementChannel } from "@goyal/db";
import { NotificationService } from "./notifications";
import { sendEmailWithLog } from "./email-log";
import { shouldCreateInAppNotification, shouldSendEmail, isAdminNotificationEnabled } from "./prefs";
import { resolveEmailTemplate } from "./template-loader";
import { announcementEmailHtml } from "./templates";
import { getAppBaseUrl } from "./urls";

export type EoiAnnouncementRecord = {
  id: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  channels: AnnouncementChannel[];
  projectId: string | null;
  priority: string;
  attachments: Array<{
    id: string;
    fileName: string;
    fileUrl: string;
    mimeType: string | null;
    kind: string;
  }>;
};

async function resolveTargetUsers(
  audience: AnnouncementAudience,
  projectId?: string | null,
): Promise<Array<{ id: string; email: string; role: string }>> {
  switch (audience) {
    case "ALL":
      return prisma.user.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, email: true, role: true },
      });
    case "ADMINS":
      return prisma.user.findMany({
        where: { role: "ADMIN", status: "ACTIVE" },
        select: { id: true, email: true, role: true },
      });
    case "CHANNEL_PARTNERS": {
      const cps = await prisma.channelPartner.findMany({
        where: { status: "APPROVED" },
        include: { user: { select: { id: true, email: true, role: true, status: true } } },
      });
      return cps
        .filter((cp) => cp.user.status === "ACTIVE")
        .map((cp) => ({ id: cp.user.id, email: cp.user.email, role: cp.user.role }));
    }
    case "CUSTOMERS": {
      const customers = await prisma.customer.findMany({
        include: { user: { select: { id: true, email: true, role: true, status: true } } },
      });
      const withActivity = new Set<string>();
      const [leadUsers, eoiUsers] = await Promise.all([
        prisma.lead.findMany({ where: { customerId: { not: null } }, select: { customerId: true } }),
        prisma.eOI.findMany({ where: { customerId: { not: null } }, select: { customerId: true } }),
      ]);
      for (const l of leadUsers) if (l.customerId) withActivity.add(l.customerId);
      for (const e of eoiUsers) if (e.customerId) withActivity.add(e.customerId);
      return customers
        .filter((c) => withActivity.has(c.id) && c.user.status === "ACTIVE")
        .map((c) => ({ id: c.user.id, email: c.user.email, role: c.user.role }));
    }
    case "PROJECT_CPS": {
      if (!projectId) return [];
      const accesses = await prisma.cPProjectAccess.findMany({
        where: { projectId },
        include: {
          cp: {
            include: { user: { select: { id: true, email: true, role: true, status: true } } },
          },
        },
      });
      return accesses
        .filter((a) => a.cp.status === "APPROVED" && a.cp.user.status === "ACTIVE")
        .map((a) => ({ id: a.cp.user.id, email: a.cp.user.email, role: a.cp.user.role }));
    }
    case "PROJECT_CUSTOMERS": {
      if (!projectId) return [];
      const customerIds = new Set<string>();
      const leads = await prisma.lead.findMany({
        where: { projectId, customerId: { not: null } },
        select: { customerId: true },
      });
      for (const l of leads) if (l.customerId) customerIds.add(l.customerId);
      const eois = await prisma.eOI.findMany({
        where: { projectId, customerId: { not: null } },
        select: { customerId: true },
      });
      for (const e of eois) if (e.customerId) customerIds.add(e.customerId);
      if (!customerIds.size) return [];
      const customers = await prisma.customer.findMany({
        where: { id: { in: [...customerIds] } },
        include: { user: { select: { id: true, email: true, role: true, status: true } } },
      });
      return customers
        .filter((c) => c.user.status === "ACTIVE")
        .map((c) => ({ id: c.user.id, email: c.user.email, role: c.user.role }));
    }
    default:
      return [];
  }
}

function buildAttachmentLinks(
  attachments: EoiAnnouncementRecord["attachments"],
  baseUrl: string,
): string {
  if (!attachments.length) return "";
  const items = attachments
    .map((a) => {
      const href = a.fileUrl.startsWith("http") ? a.fileUrl : `${baseUrl}${a.fileUrl}`;
      return `<li><a href="${href}">${a.fileName}</a></li>`;
    })
    .join("");
  return `<p><strong>Attachments:</strong></p><ul>${items}</ul>`;
}

export class AnnouncementService {
  static async publish(announcementId: string) {
    const announcement = await prisma.eoiAnnouncement.findUnique({
      where: { id: announcementId },
      include: { attachments: true, project: { select: { name: true } } },
    });
    if (!announcement) throw new Error("Announcement not found");
    if (announcement.status === "PUBLISHED") throw new Error("Already published");
    if (announcement.status === "ARCHIVED") throw new Error("Cannot publish archived announcement");

    const enabled = await isAdminNotificationEnabled("announcements").catch(() => true);
    if (!enabled) {
      await prisma.eoiAnnouncement.update({
        where: { id: announcementId },
        data: { status: "PUBLISHED", publishedAt: new Date() },
      });
      return { sent: 0, skipped: true };
    }

    const users = await resolveTargetUsers(announcement.audience, announcement.projectId);
    const uniqueUsers = [...new Map(users.map((u) => [u.id, u])).values()];
    const channels = announcement.channels.length ? announcement.channels : (["IN_APP"] as AnnouncementChannel[]);
    const baseUrl = getAppBaseUrl();
    const attachmentHtml = buildAttachmentLinks(announcement.attachments, baseUrl);

    let sent = 0;
    for (const user of uniqueUsers) {
      for (const channel of channels) {
        if (channel === "IN_APP") {
          const allow = await shouldCreateInAppNotification(user.id, "ANNOUNCEMENT");
          if (!allow) {
            await prisma.eoiAnnouncementDelivery.create({
              data: {
                announcementId,
                userId: user.id,
                channel: "IN_APP",
                status: "SKIPPED",
              },
            });
            continue;
          }
          await prisma.notification.create({
            data: {
              userId: user.id,
              type: "ANNOUNCEMENT",
              title: announcement.title,
              body: announcement.body,
              entityType: "EoiAnnouncement",
              entityId: announcement.id,
            },
          });
          await prisma.eoiAnnouncementDelivery.create({
            data: {
              announcementId,
              userId: user.id,
              channel: "IN_APP",
              status: "SENT",
              sentAt: new Date(),
            },
          });
          sent++;
        }

        if (channel === "EMAIL") {
          const allowEmail = await shouldSendEmail(user.id, "ANNOUNCEMENT");
          if (!allowEmail) {
            await prisma.eoiAnnouncementDelivery.create({
              data: {
                announcementId,
                userId: user.id,
                email: user.email,
                channel: "EMAIL",
                status: "SKIPPED",
              },
            });
            continue;
          }
          const email = await resolveEmailTemplate(
            "ANNOUNCEMENT",
            {
              recipientName: user.email.split("@")[0],
              title: announcement.title,
              body: announcement.body,
              projectName: announcement.project?.name || "",
            },
            {
              subject: announcement.title,
              html: announcementEmailHtml({
                title: announcement.title,
                body: announcement.body,
                attachmentHtml,
              }),
            },
          );
          const result = await sendEmailWithLog({
            to: user.email,
            subject: email.subject,
            html: email.html,
            type: "ANNOUNCEMENT",
            entityType: "EoiAnnouncement",
            entityId: announcement.id,
          });
          await prisma.eoiAnnouncementDelivery.create({
            data: {
              announcementId,
              userId: user.id,
              email: user.email,
              channel: "EMAIL",
              status: result.success ? "SENT" : "FAILED",
              sentAt: result.success ? new Date() : null,
            },
          });
          if (result.success) sent++;
        }
      }
    }

    await prisma.eoiAnnouncement.update({
      where: { id: announcementId },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });

    return { sent, recipients: uniqueUsers.length };
  }

  static async processScheduled() {
    const due = await prisma.eoiAnnouncement.findMany({
      where: {
        status: "SCHEDULED",
        scheduledAt: { lte: new Date() },
      },
      select: { id: true },
    });
    const results = [];
    for (const row of due) {
      results.push(await this.publish(row.id));
    }
    return { processed: due.length, results };
  }
}
