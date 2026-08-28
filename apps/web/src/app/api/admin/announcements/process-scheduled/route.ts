import { withAuth, apiResponse, apiError, withApiRoute } from "@/lib/api";
import { AnnouncementService } from "@goyal/email";

export const POST = withApiRoute("admin.announcements.processScheduled", async (req: Request) => {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = req.headers.get("authorization");
  const bearerOk = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!bearerOk) {
    const { error } = await withAuth(["ADMIN"]);
    if (error) return error;
  }

  try {
    const result = await AnnouncementService.processScheduled();
    return apiResponse(result);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : "Processing failed", 500);
  }
});
