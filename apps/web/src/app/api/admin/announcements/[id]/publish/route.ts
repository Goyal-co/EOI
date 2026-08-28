import { withAuth, apiResponse, apiError, withApiRoute } from "@/lib/api";
import { AnnouncementService } from "@goyal/email";

export const POST = withApiRoute("admin.announcements.publish", async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;
  const { id } = await params;

  try {
    const result = await AnnouncementService.publish(id);
    return apiResponse(result);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : "Publish failed", 400);
  }
});
