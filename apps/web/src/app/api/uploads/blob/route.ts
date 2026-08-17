import { apiError, withApiRoute } from "@/lib/api";

/** Legacy Vercel Blob endpoint. All documents now go through S3 via POST /api/uploads. */
export const POST = withApiRoute("uploads.blob", async () => {
  return apiError("Document uploads use S3 via POST /api/uploads. Blob uploads are disabled.", 410);
});
