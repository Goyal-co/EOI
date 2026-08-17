import { apiError, withApiRoute } from "@/lib/api";

/** Legacy. Uploads go through POST /api/uploads into S3. */
export const POST = withApiRoute("uploads.presign", async () => {
  return apiError("Use POST /api/uploads. Direct/presigned S3 uploads are disabled.", 410);
});
