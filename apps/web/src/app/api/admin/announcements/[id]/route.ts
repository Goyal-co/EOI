import { prisma } from "@goyal/db";
import { announcementUpdateSchema } from "@goyal/types";
import { withAuth, apiResponse, apiError, withApiRoute } from "@/lib/api";

export const GET = withApiRoute("admin.announcements.get", async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;
  const { id } = await params;

  const row = await prisma.eoiAnnouncement.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, name: true } },
      createdBy: { select: { name: true, email: true } },
      attachments: true,
      deliveries: { take: 50, orderBy: { sentAt: "desc" } },
    },
  });
  if (!row) return apiError("Not found", 404);
  return apiResponse(row);
});

export const PATCH = withApiRoute("admin.announcements.patch", async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;
  const { id } = await params;

  const existing = await prisma.eoiAnnouncement.findUnique({ where: { id } });
  if (!existing) return apiError("Not found", 404);
  if (existing.status === "PUBLISHED") return apiError("Published announcements cannot be edited", 400);

  const body = await req.json().catch(() => null);
  const parsed = announcementUpdateSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0].message);

  const scheduledAt = parsed.data.scheduledAt === undefined
    ? undefined
    : parsed.data.scheduledAt
      ? new Date(parsed.data.scheduledAt)
      : null;
  const expiresAt = parsed.data.expiresAt === undefined
    ? undefined
    : parsed.data.expiresAt
      ? new Date(parsed.data.expiresAt)
      : null;

  let status = existing.status;
  if (scheduledAt && scheduledAt > new Date()) status = "SCHEDULED";
  else if (existing.status === "SCHEDULED" && !scheduledAt) status = "DRAFT";

  const row = await prisma.eoiAnnouncement.update({
    where: { id },
    data: {
      ...(parsed.data.title !== undefined ? { title: parsed.data.title.trim() } : {}),
      ...(parsed.data.body !== undefined ? { body: parsed.data.body.trim() } : {}),
      ...(parsed.data.audience !== undefined ? { audience: parsed.data.audience } : {}),
      ...(parsed.data.channels !== undefined ? { channels: parsed.data.channels } : {}),
      ...(parsed.data.projectId !== undefined ? { projectId: parsed.data.projectId || null } : {}),
      ...(parsed.data.priority !== undefined ? { priority: parsed.data.priority } : {}),
      ...(scheduledAt !== undefined ? { scheduledAt } : {}),
      ...(expiresAt !== undefined ? { expiresAt } : {}),
      status,
    },
    include: { attachments: true, project: { select: { id: true, name: true } } },
  });

  return apiResponse(row);
});

export const DELETE = withApiRoute("admin.announcements.delete", async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;
  const { id } = await params;

  await prisma.eoiAnnouncement.update({
    where: { id },
    data: { status: "ARCHIVED" },
  });
  return apiResponse({ ok: true });
});
