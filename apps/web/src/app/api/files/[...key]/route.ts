import { auth } from "@goyal/auth";
import { apiError, withApiRoute } from "@/lib/api";
import { DocumentService } from "@/lib/services/document";
import { getS3Prefix } from "@/lib/storage/s3";

export const runtime = "nodejs";

const PUBLIC_FOLDERS = new Set([
  "banner",
  "gallery",
  "brochure",
  "floor_plan",
  "creative",
  "walkthrough",
  "location",
  "cost_sheet",
]);

const ROLE_FOLDERS = new Set(["admin", "customer", "channel_partner"]);

function isPublicAssetKey(key: string): boolean {
  const parts = key.split("/").map((p) => p.toLowerCase());
  return parts.some((part) => PUBLIC_FOLDERS.has(part));
}

function isSafeObjectKey(key: string): boolean {
  if (!key || key.includes("..") || key.startsWith("/") || key.includes("\\")) return false;
  const prefix = getS3Prefix();
  if (key.startsWith(`${prefix}/`)) return true;
  const first = key.split("/")[0]?.toLowerCase();
  return ROLE_FOLDERS.has(first);
}

function canReadKey(
  key: string,
  session: { user?: { id?: string; role?: string } } | null,
): boolean {
  if (isPublicAssetKey(key)) return true;
  const role = session?.user?.role;
  const userId = session?.user?.id;
  if (!role || !userId) return false;
  if (role === "ADMIN") return true;
  const roleFolder = role.toLowerCase();
  const prefix = getS3Prefix();
  return (
    key.startsWith(`${prefix}/${roleFolder}/${userId}/`)
    || key.startsWith(`${roleFolder}/${userId}/`)
  );
}

export const GET = withApiRoute("files.get", async (req: Request, { params }: { params: Promise<{ key: string[] }> }) => {
  const { key: segments } = await params;
  const key = (segments || []).map((part) => decodeURIComponent(part)).join("/");
  if (!isSafeObjectKey(key)) return apiError("Not found", 404);

  const session = await auth();
  if (!canReadKey(key, session)) {
    return apiError(session?.user ? "Forbidden" : "Unauthorized", session?.user ? 403 : 401);
  }

  try {
    const url = new URL(req.url);
    const disposition =
      url.searchParams.get("download") === "1" ? "attachment" : "inline";
    return await DocumentService.streamStoredFile(key, {
      fileName: key.split("/").pop() || null,
      disposition,
    });
  } catch (cause) {
    return apiError("File not found", 404, undefined, { cause });
  }
});
