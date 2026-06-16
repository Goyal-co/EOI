import {
  encryptPII,
  decryptPII,
  isEncrypted,
  maskPAN,
  maskAadhaar,
  maskAccountNumber,
} from "@/lib/crypto/pii";

const SENSITIVE_PATHS: Record<string, string[]> = {
  personal: ["panNumber", "aadhaarNumber"],
  bankDetails: ["accountNumber", "ifscCode"],
};

function encryptSection(
  section: Record<string, unknown> | undefined,
  fields: string[]
): Record<string, unknown> | undefined {
  if (!section) return section;
  const out = { ...section };
  for (const field of fields) {
    const val = out[field];
    if (typeof val === "string" && val && !isEncrypted(val)) {
      out[field] = encryptPII(val);
    }
  }
  return out;
}

function decryptSection(
  section: Record<string, unknown> | undefined,
  fields: string[]
): Record<string, unknown> | undefined {
  if (!section) return section;
  const out = { ...section };
  for (const field of fields) {
    const val = out[field];
    if (typeof val === "string" && isEncrypted(val)) {
      out[field] = decryptPII(val);
    }
  }
  return out;
}

function maskSection(
  section: Record<string, unknown> | undefined,
  fields: string[],
  maskFn: (v: string) => string
): Record<string, unknown> | undefined {
  if (!section) return section;
  const out = { ...section };
  for (const field of fields) {
    const val = out[field];
    if (typeof val === "string" && val) {
      out[field] = maskFn(val);
    }
  }
  return out;
}

export function encryptFormData(formData: Record<string, unknown>): Record<string, unknown> {
  const out = { ...formData };
  for (const [section, fields] of Object.entries(SENSITIVE_PATHS)) {
    const sec = out[section] as Record<string, unknown> | undefined;
    if (sec) out[section] = encryptSection(sec, fields);
  }
  return out;
}

export function decryptFormData(formData: Record<string, unknown>): Record<string, unknown> {
  const out = { ...formData };
  for (const [section, fields] of Object.entries(SENSITIVE_PATHS)) {
    const sec = out[section] as Record<string, unknown> | undefined;
    if (sec) out[section] = decryptSection(sec, fields);
  }
  return out;
}

export function maskFormData(formData: Record<string, unknown>): Record<string, unknown> {
  const out = { ...formData };
  const personal = out.personal as Record<string, unknown> | undefined;
  if (personal) {
    out.personal = {
      ...personal,
      ...maskSection(personal, ["panNumber"], maskPAN),
      ...maskSection(personal, ["aadhaarNumber"], maskAadhaar),
    };
  }
  const bank = out.bankDetails as Record<string, unknown> | undefined;
  if (bank) {
    out.bankDetails = {
      ...bank,
      ...maskSection(bank, ["accountNumber"], maskAccountNumber),
    };
  }
  return out;
}
