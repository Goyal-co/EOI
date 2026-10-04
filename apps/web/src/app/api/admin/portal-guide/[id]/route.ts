import { prisma } from "@goyal/db";
import { portalGuideVideoUpdateSchema } from "@goyal/types";
import { withAuth, apiResponse, apiError, withApiRoute } from "@/lib/api";

function parseDurationSec(label?: string | null, explicit?: number | null) {
  if (typeof explicit === "number" && Number.isFinite(explicit)) return explicit;
  if (!label) return null;
  const m = label.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export const GET = withApiRoute("admin.portalGuide.get", async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;
  const { id } = await params;

  const row = await prisma.portalGuideVideo.findUnique({ where: { id } });
  if (!row) return apiError("Video not found", 404);
  return apiResponse(row);
});

export const PATCH = withApiRoute("admin.portalGuide.update", async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;
  const { id } = await params;

  const existing = await prisma.portalGuideVideo.findUnique({ where: { id } });
  if (!existing) return apiError("Video not found", 404);

  const body = await req.json().catch(() => null);
  const parsed = portalGuideVideoUpdateSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0]?.message || "Invalid payload");

  const data = parsed.data;
  const nextLabel =
    data.durationLabel !== undefined ? data.durationLabel : existing.durationLabel;
  const durationSec =
    data.durationSec !== undefined || data.durationLabel !== undefined
      ? parseDurationSec(nextLabel, data.durationSec ?? null)
      : existing.durationSec;

  const row = await prisma.$transaction(async (tx) => {
    if (data.featured === true) {
      await tx.portalGuideVideo.updateMany({
        where: { featured: true, NOT: { id } },
        data: { featured: false },
      });
    }
    return tx.portalGuideVideo.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title.trim() } : {}),
        ...(data.description !== undefined
          ? { description: data.description?.trim() || null }
          : {}),
        ...(data.videoUrl !== undefined ? { videoUrl: data.videoUrl } : {}),
        ...(data.thumbnailUrl !== undefined
          ? { thumbnailUrl: data.thumbnailUrl || null }
          : {}),
        ...(data.durationLabel !== undefined
          ? { durationLabel: data.durationLabel || null }
          : {}),
        ...(data.durationSec !== undefined || data.durationLabel !== undefined
          ? { durationSec }
          : {}),
        ...(data.featured !== undefined ? { featured: data.featured } : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
      },
    });
  });

  return apiResponse(row);
});

export const DELETE = withApiRoute("admin.portalGuide.delete", async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;
  const { id } = await params;

  const existing = await prisma.portalGuideVideo.findUnique({ where: { id } });
  if (!existing) return apiError("Video not found", 404);

  await prisma.portalGuideVideo.delete({ where: { id } });
  return apiResponse({ ok: true });
});
