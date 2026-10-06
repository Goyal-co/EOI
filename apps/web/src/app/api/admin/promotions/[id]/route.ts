import { prisma } from "@goyal/db";
import {
  PARTNER_PROMO_HEIGHT,
  PARTNER_PROMO_WIDTH,
  partnerPromotionUpdateSchema,
} from "@goyal/types";
import { withAuth, apiResponse, apiError, withApiRoute } from "@/lib/api";
import { DocumentService } from "@/lib/services/document";
import { imageSize } from "image-size";

const MAX_VALIDATION_IMAGE_BYTES = 10 * 1024 * 1024;

async function readActualImageDimensions(fileUrl: string) {
  const bytes = await DocumentService.readStoredBytes(fileUrl);
  if (bytes.byteLength > MAX_VALIDATION_IMAGE_BYTES) {
    throw new Error("Image exceeds the 10 MB validation limit");
  }

  const dimensions = imageSize(bytes);
  if (!dimensions.width || !dimensions.height) {
    throw new Error("Could not determine uploaded image dimensions");
  }
  return { width: dimensions.width, height: dimensions.height };
}

export const GET = withApiRoute("admin.promotions.get", async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;
  const { id } = await params;

  const row = await prisma.partnerPromotion.findUnique({ where: { id } });
  if (!row) return apiError("Promotion not found", 404);
  return apiResponse(row);
});

export const PATCH = withApiRoute("admin.promotions.update", async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;
  const { id } = await params;

  const existing = await prisma.partnerPromotion.findUnique({ where: { id } });
  if (!existing) return apiError("Promotion not found", 404);

  const body = await req.json().catch(() => null);
  const parsed = partnerPromotionUpdateSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0]?.message || "Invalid payload");

  const data = parsed.data;
  const nextMediaUrl = data.mediaUrl ?? existing.mediaUrl;
  const nextMediaKind = data.mediaKind ?? existing.mediaKind;

  if (data.mediaUrl) {
    const stored = await DocumentService.objectExists(data.mediaUrl);
    if (!stored) {
      return apiError("Uploaded file not found in storage. Please upload again.", 400);
    }
  }

  if (
    (nextMediaKind === "IMAGE" || nextMediaKind === "GIF") &&
    (data.mediaUrl || data.mediaKind || data.width !== undefined || data.height !== undefined)
  ) {
    try {
      const actual = await readActualImageDimensions(nextMediaUrl);
      if (actual.width !== PARTNER_PROMO_WIDTH || actual.height !== PARTNER_PROMO_HEIGHT) {
        return apiError(
          `Promotion creative must be exactly ${PARTNER_PROMO_WIDTH}×${PARTNER_PROMO_HEIGHT}px (actual ${actual.width}×${actual.height}px)`,
        );
      }
    } catch (validationError) {
      return apiError(
        validationError instanceof Error
          ? validationError.message
          : "Could not validate image dimensions",
        400,
        undefined,
        { cause: validationError },
      );
    }
  }

  const startsAt =
    data.startsAt !== undefined
      ? data.startsAt
        ? new Date(data.startsAt)
        : null
      : existing.startsAt;
  const endsAt =
    data.endsAt !== undefined
      ? data.endsAt
        ? new Date(data.endsAt)
        : null
      : existing.endsAt;

  if (startsAt && endsAt && startsAt > endsAt) {
    return apiError("endsAt must be after startsAt");
  }

  const row = await prisma.partnerPromotion.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title.trim() } : {}),
      ...(data.mediaUrl !== undefined ? { mediaUrl: data.mediaUrl } : {}),
      ...(data.mediaKind !== undefined ? { mediaKind: data.mediaKind } : {}),
      ...(data.linkUrl !== undefined ? { linkUrl: data.linkUrl || null } : {}),
      ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
      ...(data.startsAt !== undefined ? { startsAt } : {}),
      ...(data.endsAt !== undefined ? { endsAt } : {}),
    },
  });

  return apiResponse(row);
});

export const DELETE = withApiRoute("admin.promotions.delete", async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;
  const { id } = await params;

  const existing = await prisma.partnerPromotion.findUnique({ where: { id } });
  if (!existing) return apiError("Promotion not found", 404);

  await prisma.partnerPromotion.delete({ where: { id } });
  return apiResponse({ ok: true });
});
