import type { CRMProvider } from "../types";

export const mockCRMProvider: CRMProvider = {
  async syncLead(data: Record<string, unknown>) {
    console.log("[CRM Mock] syncLead", data);
    return { success: true, crmId: `mock-lead-${Date.now()}` };
  },

  async syncEOI(data: Record<string, unknown>) {
    console.log("[CRM Mock] syncEOI", data);
    return { success: true, crmId: `mock-eoi-${Date.now()}` };
  },
};
