import type { SMSProvider } from "../types";
import { mockSMSProvider } from "./mock";
import { msg91SMSProvider } from "./msg91";

export function getSMSProvider(): SMSProvider {
  const provider = process.env.SMS_PROVIDER || "mock";
  switch (provider) {
    case "msg91":
      return msg91SMSProvider;
    case "mock":
    default:
      return mockSMSProvider;
  }
}
