import { prisma } from "@goyal/db";
import {
  PARTNER_PROMO_HEIGHT,
  PARTNER_PROMO_WIDTH,
  partnerPromotionCreateSchema,
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

export const GET = withApiRoute("admin.promotions.list", async () => {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;

  const rows = await prisma.partnerPromotion.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
  return apiResponse(rows);
});

export const POST = withApiRoute("admin.promotions.create", async (req: Request) => {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = partnerPromotionCreateSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0]?.message || "Invalid payload");

  const data = parsed.data;
  const stored = await DocumentService.objectExists(data.mediaUrl);
  if (!stored) {
    return apiError("Uploaded file not found in storage. Please upload again.", 400);
  }

  if (data.mediaKind === "IMAGE" || data.mediaKind === "GIF") {
    try {
      const actual = await readActualImageDimensions(data.mediaUrl);
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

  const row = await prisma.partnerPromotion.create({
    data: {
      title: data.title.trim(),
      mediaUrl: data.mediaUrl,
      mediaKind: data.mediaKind,
      linkUrl: data.linkUrl || null,
      sortOrder: data.sortOrder ?? 0,
      active: data.active ?? true,
      startsAt: data.startsAt ? new Date(data.startsAt) : null,
      endsAt: data.endsAt ? new Date(data.endsAt) : null,
    },
  });

  return apiResponse(row, 201);
});
