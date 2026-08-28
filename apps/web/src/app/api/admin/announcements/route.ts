import { prisma } from "@goyal/db";
import { announcementCreateSchema } from "@goyal/types";
import { withAuth, apiResponse, apiError, withApiRoute } from "@/lib/api";

export const GET = withApiRoute("admin.announcements.list", async (req: Request) => {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");

  const rows = await prisma.eoiAnnouncement.findMany({
    where: status ? { status: status as never } : undefined,
    include: {
      project: { select: { id: true, name: true } },
      createdBy: { select: { name: true, email: true } },
      attachments: true,
      _count: { select: { deliveries: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return apiResponse(rows);
});

export const POST = withApiRoute("admin.announcements.create", async (req: Request) => {
  const { error, session } = await withAuth(["ADMIN"]);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = announcementCreateSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0].message);

  const scheduledAt = parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null;
  const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;
  const status = scheduledAt && scheduledAt > new Date() ? "SCHEDULED" : "DRAFT";

  const row = await prisma.eoiAnnouncement.create({
    data: {
      title: parsed.data.title.trim(),
      body: parsed.data.body.trim(),
      audience: parsed.data.audience,
      channels: parsed.data.channels,
      projectId: parsed.data.projectId || null,
      priority: parsed.data.priority,
      scheduledAt,
      expiresAt,
      status,
      createdById: session!.user.id,
    },
    include: { attachments: true, project: { select: { id: true, name: true } } },
  });

  return apiResponse(row, 201);
});
