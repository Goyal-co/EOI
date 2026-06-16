import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const PREFIX = "enc:v1:";

function getKey(): Buffer {
  const secret = process.env.PII_ENCRYPTION_KEY || process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("PII_ENCRYPTION_KEY or AUTH_SECRET is required in production");
    }
    return crypto.createHash("sha256").update("dev-pii-key-not-for-production").digest();
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export function isEncrypted(value: string): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export function encryptPII(plaintext: string): string {
  if (!plaintext || isEncrypted(plaintext)) return plaintext;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptPII(ciphertext: string): string {
  if (!ciphertext || !isEncrypted(ciphertext)) return ciphertext;
  const payload = ciphertext.slice(PREFIX.length);
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) return ciphertext;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function maskPAN(value: string): string {
  const plain = isEncrypted(value) ? "**********" : value;
  if (plain.length < 4) return "****";
  return `XXXXX${plain.slice(-4)}`;
}

export function maskAadhaar(value: string): string {
  const plain = isEncrypted(value) ? "************" : value;
  if (plain.length < 4) return "XXXX XXXX ****";
  return `XXXX XXXX ${plain.slice(-4)}`;
}

export function maskAccountNumber(value: string): string {
  const plain = isEncrypted(value) ? "********" : value;
  if (plain.length < 4) return "****";
  return `****${plain.slice(-4)}`;
}
