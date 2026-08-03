import { prisma } from "@goyal/db";
import { projectAssetSchema } from "@goyal/types";
import { withAuth, apiResponse, apiError } from "@/lib/api";
import { DocumentService } from "@/lib/services/document";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;
  const { id } = await params;

  const assets = await prisma.projectAsset.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
  });
  return apiResponse(assets);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;
  const { id } = await params;

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return apiError("Project not found", 404);

  const body = await req.json();
  const parsed = projectAssetSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0].message);

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
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
  } catch {
    // continue with DB delete
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
}
