import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().optional(),
  AUTH_SECRET: z.string().optional(),
  PII_ENCRYPTION_KEY: z.string().optional(),
  REDIS_URL: z.string().optional(),
  BREVO_API_KEY: z.string().optional(),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  NEXTAUTH_URL: z.string().optional(),
  CRON_SECRET: z.string().optional(),
});

function validateEnv() {
  // Support legacy ENCRYPTION_KEY alias
  if (!process.env.PII_ENCRYPTION_KEY && process.env.ENCRYPTION_KEY) {
    process.env.PII_ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
  }

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) return;

  if (parsed.data.NODE_ENV === "production") {
    const required: Record<string, string | undefined> = {
      DATABASE_URL: process.env.DATABASE_URL,
      AUTH_SECRET: process.env.AUTH_SECRET,
      PII_ENCRYPTION_KEY: process.env.PII_ENCRYPTION_KEY,
      REDIS_URL: process.env.REDIS_URL,
      BREVO_API_KEY: process.env.BREVO_API_KEY,
    };

    const hasBlob = !!process.env.BLOB_READ_WRITE_TOKEN?.trim();
    const hasS3 = !!process.env.S3_ACCESS_KEY?.trim();
    if (!hasBlob && !hasS3) {
      throw new Error(
        "Missing file storage: set BLOB_READ_WRITE_TOKEN (Vercel Blob) or S3_ACCESS_KEY + S3_SECRET_KEY"
      );
    }
    if (hasS3) {
      if (!process.env.S3_SECRET_KEY) {
        throw new Error("S3_SECRET_KEY is required when S3_ACCESS_KEY is set");
      }
    }
    for (const [key, value] of Object.entries(required)) {
      if (!value) {
        throw new Error(`Missing required production environment variable: ${key}`);
      }
    }
    if ((process.env.AUTH_SECRET?.length ?? 0) < 16) {
      throw new Error("AUTH_SECRET must be at least 16 characters in production");
    }
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.warn(
        "[env] GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not set — customer Google login will be disabled"
      );
    }
  }
}

validateEnv();
