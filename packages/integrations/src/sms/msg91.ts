import type { SMSProvider } from "../types";

export const msg91SMSProvider: SMSProvider = {
  async sendSMS(to: string, message: string) {
    const authKey = process.env.MSG91_AUTH_KEY;
    const senderId = process.env.MSG91_SENDER_ID || "GOYAL";
    const templateId = process.env.MSG91_TEMPLATE_ID;

    if (!authKey) {
      if (process.env.NODE_ENV === "production") {
        return { success: false };
      }
      console.log("[SMS Mock MSG91]", { to, message });
      return { success: true, messageId: `mock-${Date.now()}` };
    }

    try {
      const mobile = to.replace(/\D/g, "").slice(-10);
      const res = await fetch("https://control.msg91.com/api/v5/flow/", {
        method: "POST",
        headers: {
          authkey: authKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          template_id: templateId,
          short_url: "0",
          recipients: [{ mobiles: `91${mobile}`, var: message }],
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error("[MSG91]", err);
        return { success: false };
      }

      const data = (await res.json()) as { request_id?: string; message?: string };
      return { success: true, messageId: data.request_id || data.message };
    } catch (error) {
      console.error("[MSG91]", error);
      return { success: false };
    }
  },

  async sendWhatsApp(to: string, message: string) {
    return this.sendSMS(to, message);
  },
};
