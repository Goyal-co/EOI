import type { SMSProvider } from "../types";

export const mockSMSProvider: SMSProvider = {
  async sendSMS(to: string, message: string) {
    console.log("[SMS Mock]", { to, message });
    return { success: true, messageId: `mock-sms-${Date.now()}` };
  },

  async sendWhatsApp(to: string, message: string) {
    console.log("[WhatsApp Mock]", { to, message });
    return { success: true, messageId: `mock-wa-${Date.now()}` };
  },
};
