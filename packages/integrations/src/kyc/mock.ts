import type { KYCProvider, VerificationResult } from "../types";

export const mockKYCProvider: KYCProvider = {
  async verifyPAN(pan: string): Promise<VerificationResult> {
    const valid = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan);
    return {
      valid,
      name: valid ? "Mock Verified Name" : undefined,
      message: valid ? "PAN verified (mock)" : "Invalid PAN format",
    };
  },

  async verifyAadhaar(aadhaar: string): Promise<VerificationResult> {
    const valid = /^\d{12}$/.test(aadhaar);
    return {
      valid,
      message: valid ? "Aadhaar verified (mock)" : "Invalid Aadhaar format",
    };
  },
};
