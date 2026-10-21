-- Admin-only notes on support tickets. Partners never receive these rows.
ALTER TABLE "SupportMessage" ADD COLUMN IF NOT EXISTS "internal" BOOLEAN NOT NULL DEFAULT false;
