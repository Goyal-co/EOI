import type { CRMProvider } from "../types";
import { mockCRMProvider } from "./mock";
import { goyalCRMProvider } from "./goyal-eoi";

export function getCRMProvider(): CRMProvider {
  const provider = (process.env.CRM_PROVIDER || "mock").toLowerCase().trim();

  // Explicit goyal/http, or auto-enable when EOI webhook key is present.
  if (provider === "goyal" || provider === "http" || provider === "goyal-hariyana") {
    return goyalCRMProvider;
  }

  if (provider === "mock" && process.env.EOI_API_KEY?.trim()) {
    // Prefer live CRM when key is configured even if CRM_PROVIDER left at mock default.
    return goyalCRMProvider;
  }

  return mockCRMProvider;
}

export { mapToGoyalEoiPayload } from "./goyal-eoi";
