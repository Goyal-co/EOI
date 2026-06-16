import type { KYCProvider } from "../types";
import { mockKYCProvider } from "./mock";

export function getKYCProvider(): KYCProvider {
  const provider = process.env.KYC_PROVIDER || "mock";
  switch (provider) {
    case "mock":
    default:
      return mockKYCProvider;
  }
}
