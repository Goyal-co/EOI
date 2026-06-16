import { getSystemSettings } from "@/lib/services/system-settings";
import { apiResponse } from "@/lib/api";

export async function GET() {
  const settings = await getSystemSettings();
  return apiResponse({ supportEmail: settings.profile.supportEmail });
}
