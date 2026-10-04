import { prisma } from "@goyal/db";
import { portalGuideVideoCreateSchema } from "@goyal/types";
import { withAuth, apiResponse, apiError, withApiRoute } from "@/lib/api";

function parseDurationSec(label?: string | null, explicit?: number | null) {
  if (typeof explicit === "number" && Number.isFinite(explicit)) return explicit;
  if (!label) return null;
  const m = label.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export const GET = withApiRoute("admin.portalGuide.list", async () => {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;

  const rows = await prisma.portalGuideVideo.findMany({
    orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
  });
  return apiResponse(rows);
});

export const POST = withApiRoute("admin.portalGuide.create", async (req: Request) => {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = portalGuideVideoCreateSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0]?.message || "Invalid payload");

  const data = parsed.data;
  const durationSec = parseDurationSec(data.durationLabel, data.durationSec);

  const row = await prisma.$transaction(async (tx) => {
    if (data.featured) {
      await tx.portalGuideVideo.updateMany({
        where: { featured: true },
        data: { featured: false },
      });
    }
    return tx.portalGuideVideo.create({
      data: {
        title: data.title.trim(),
        description: data.description?.trim() || null,
        videoUrl: data.videoUrl,
        thumbnailUrl: data.thumbnailUrl || null,
        durationLabel: data.durationLabel || null,
        durationSec,
        featured: Boolean(data.featured),
        sortOrder: data.sortOrder ?? 0,
        active: data.active ?? true,
      },
    });
  });

  return apiResponse(row, 201);
});
