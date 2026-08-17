import { prisma } from "@goyal/db";
import { notificationMarkReadSchema } from "@goyal/types";
import { withAuth, apiResponse, apiError, withApiRoute } from "@/lib/api";
export const GET = withApiRoute("notifications.get", async (req: Request) => {
  const { error, session } = await withAuth();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "true";

  const notifications = await prisma.notification.findMany({
    where: {
      userId: session!.user.id,
      ...(unreadOnly ? { read: false } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const unreadCount = await prisma.notification.count({
    where: { userId: session!.user.id, read: false },
  });

  return apiResponse({ notifications, unreadCount });
});

export const PATCH = withApiRoute("notifications.patch", async (req: Request) => {
  const { error, session } = await withAuth();
  if (error) return error;

  const body = await req.json();
  const parsed = notificationMarkReadSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0].message);
  const { ids, markAll } = parsed.data;
  if (markAll) {
    await prisma.notification.updateMany({
      where: { userId: session!.user.id, read: false },
      data: { read: true },
    });
  } else if (ids?.length) {
    await prisma.notification.updateMany({
      where: { id: { in: ids }, userId: session!.user.id },
      data: { read: true },
    });
  }

  return apiResponse({ success: true });
});
