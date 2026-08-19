import { prisma } from "@goyal/db";
import {
  PROJECT_BANNER_HEIGHT,
  PROJECT_BANNER_WIDTH,
  PROJECT_LOCATION_HEIGHT,
  PROJECT_LOCATION_WIDTH,
  projectAssetSchema,
} from "@goyal/types";
import { withAuth, apiResponse, apiError, withApiRoute } from "@/lib/api";
import { DocumentService } from "@/lib/services/document";
import { logServerWarn } from "@/lib/server-log";
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

export const GET = withApiRoute("admin.project-assets.get", async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;
  const { id } = await params;

  const assets = await prisma.projectAsset.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
  });
  return apiResponse(assets);
});

export const POST = withApiRoute("admin.project-assets.create", async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;
  const { id } = await params;

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return apiError("Project not found", 404);

  const body = await req.json();
  const parsed = projectAssetSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0].message);

  const stored = await DocumentService.objectExists(parsed.data.fileUrl);
  if (!stored) {
    return apiError("Uploaded file not found in storage. Please upload again.", 400);
  }

  if (parsed.data.type === "BANNER" || parsed.data.type === "LOCATION") {
    try {
      const actual = await readActualImageDimensions(parsed.data.fileUrl);
      const expected =
        parsed.data.type === "BANNER"
          ? { width: PROJECT_BANNER_WIDTH, height: PROJECT_BANNER_HEIGHT }
          : { width: PROJECT_LOCATION_WIDTH, height: PROJECT_LOCATION_HEIGHT };

      if (actual.width !== expected.width || actual.height !== expected.height) {
        return apiError(
          `${parsed.data.type === "BANNER" ? "Banner" : "Location image"} must be exactly ${expected.width}×${expected.height}px (actual ${actual.width}×${actual.height}px)`,
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

  const asset = await prisma.projectAsset.create({
    data: {
      projectId: id,
      type: parsed.data.type,
      fileName: parsed.data.fileName,
      fileUrl: parsed.data.fileUrl,
      fileSize: parsed.data.fileSize,
    },
  });

  if (parsed.data.type === "BANNER") {
    await prisma.project.update({
      where: { id },
      data: { bannerUrl: parsed.data.fileUrl },
    });
  }

  if (parsed.data.type === "LOCATION") {
    await prisma.project.update({
      where: { id },
      data: { locationImageUrl: parsed.data.fileUrl },
    });
  }

  return apiResponse(asset, 201);
});

export const DELETE = withApiRoute("admin.project-assets.delete", async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;
  const { id } = await params;

  const { searchParams } = new URL(req.url);
  const assetId = searchParams.get("assetId");
  if (!assetId) return apiError("assetId required");

  const asset = await prisma.projectAsset.findFirst({
    where: { id: assetId, projectId: id },
  });
  if (!asset) return apiError("Asset not found", 404);

  try {
    await DocumentService.deleteStoredFile(asset.fileUrl);
  } catch (cause) {
    logServerWarn("admin.project-assets.delete", "Failed to delete stored file", { fileUrl: asset.fileUrl }, cause);
  }

  if (asset.type === "BANNER" || asset.type === "LOCATION") {
    const project = await prisma.project.findUnique({
      where: { id },
      select: { bannerUrl: true, locationImageUrl: true },
    });
    if (project) {
      const data: { bannerUrl?: null; locationImageUrl?: null } = {};
      if (asset.type === "BANNER" && project.bannerUrl === asset.fileUrl) {
        data.bannerUrl = null;
      }
      if (asset.type === "LOCATION" && project.locationImageUrl === asset.fileUrl) {
        data.locationImageUrl = null;
      }
      if (Object.keys(data).length > 0) {
        await prisma.project.update({ where: { id }, data });
      }
    }
  }

  await prisma.projectAsset.delete({ where: { id: assetId } });
  return apiResponse({ success: true });
});
