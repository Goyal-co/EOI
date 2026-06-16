import { describe, it, expect } from "vitest";
import { encryptPII, decryptPII, isEncrypted, maskPAN, maskAadhaar } from "./pii";

describe("PII encryption", () => {
  it("encrypts and decrypts plaintext", () => {
    const original = "ABCDE1234F";
    const encrypted = encryptPII(original);
    expect(isEncrypted(encrypted)).toBe(true);
    expect(decryptPII(encrypted)).toBe(original);
  });

  it("does not double-encrypt", () => {
    const encrypted = encryptPII("123456789012");
    expect(encryptPII(encrypted)).toBe(encrypted);
  });

  it("masks PAN and Aadhaar", () => {
    expect(maskPAN("ABCDE1234F")).toBe("XXXXX234F");
    expect(maskAadhaar("123456789012")).toBe("XXXX XXXX 9012");
  });
});
