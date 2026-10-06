import { getSystemSettings } from "@/lib/services/system-settings";
import { apiError } from "@/lib/api";

/** Whether CPs may send confirmation emails / activate leads. Default true. */
export async function isCpConfirmationFlowEnabled(): Promise<boolean> {
  const settings = await getSystemSettings();
  return settings.permissions.cpConfirmationFlowEnabled !== false;
}

export async function requireCpConfirmationFlowEnabled() {
  const enabled = await isCpConfirmationFlowEnabled();
  if (!enabled) {
    return apiError(
      "Customer confirmation is disabled by admin. Contact your administrator.",
      403,
      "CONFIRMATION_FLOW_DISABLED",
    );
  }
  return null;
}
