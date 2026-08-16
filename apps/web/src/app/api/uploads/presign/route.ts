import { apiError } from "@/lib/api";

/** Legacy. Uploads go through POST /api/uploads into S3. */
export async function POST() {
  return apiError("Use POST /api/uploads. Direct/presigned S3 uploads are disabled.", 410);
}
