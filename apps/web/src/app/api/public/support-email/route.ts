import { getSystemSettings } from "@/lib/services/system-settings";
import { apiResponse, withApiRoute } from "@/lib/api";

export const GET = withApiRoute("public.support-email.get", async () => {
  const settings = await getSystemSettings();
  return apiResponse({ supportEmail: settings.profile.supportEmail });
});
