export interface VerificationResult {
  valid: boolean;
  name?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface KYCProvider {
  verifyPAN(pan: string): Promise<VerificationResult>;
  verifyAadhaar(aadhaar: string, otp?: string): Promise<VerificationResult>;
}

export interface SMSProvider {
  sendSMS(to: string, message: string): Promise<{ success: boolean; messageId?: string }>;
  sendWhatsApp(to: string, message: string): Promise<{ success: boolean; messageId?: string }>;
}

export interface CRMProvider {
  syncLead(data: Record<string, unknown>): Promise<{ success: boolean; crmId?: string }>;
  syncEOI(data: Record<string, unknown>): Promise<{ success: boolean; crmId?: string }>;
}
