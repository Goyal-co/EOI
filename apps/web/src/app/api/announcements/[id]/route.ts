import { prisma } from "@goyal/db";
import { withAuth, apiResponse, apiError, withApiRoute } from "@/lib/api";

export const GET = withApiRoute("announcements.get", async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { error, session } = await withAuth();
  if (error) return error;
  const { id } = await params;

  const row = await prisma.eoiAnnouncement.findUnique({
    where: { id },
    include: {
      project: { select: { name: true } },
      attachments: true,
    },
  });
  if (!row) return apiError("Not found", 404);
  if (row.status !== "PUBLISHED") return apiError("Not found", 404);

  const received = await prisma.notification.findFirst({
    where: {
      userId: session!.user.id,
      entityType: "EoiAnnouncement",
      entityId: id,
    },
  });
  const delivered = await prisma.eoiAnnouncementDelivery.findFirst({
    where: { announcementId: id, userId: session!.user.id },
  });
  if (!received && !delivered && session!.user.role !== "ADMIN") {
    return apiError("Forbidden", 403);
  }

  return apiResponse({
    id: row.id,
    title: row.title,
    body: row.body,
    priority: row.priority,
    publishedAt: row.publishedAt,
    project: row.project,
    attachments: row.attachments,
  });
});
