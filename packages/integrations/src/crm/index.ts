import type { CRMProvider } from "../types";
import { mockCRMProvider } from "./mock";

export function getCRMProvider(): CRMProvider {
  const provider = process.env.CRM_PROVIDER || "mock";
  switch (provider) {
    case "mock":
    default:
      return mockCRMProvider;
  }
}
