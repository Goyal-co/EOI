-- Sync production schema with Prisma (fields/tables added after 0_init)

-- AlterEnum
ALTER TYPE "CustomerJourneyStatus" ADD VALUE IF NOT EXISTS 'LEAD_CONFIRMED';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "LeadIntent" AS ENUM ('EOI', 'LEAD_ONLY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EmailDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'RETRYING');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "preferences" JSONB;

ALTER TABLE "ChannelPartner" ADD COLUMN IF NOT EXISTS "blockReason" TEXT;

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "faqs" JSONB;

ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "intentType" "LeadIntent" NOT NULL DEFAULT 'EOI';

-- CreateTable
CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EmailLog" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "type" TEXT,
    "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "providerId" TEXT,
    "error" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "entityType" TEXT,
    "entityId" TEXT,
    "html" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SystemSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "profile" JSONB,
    "notifications" JSONB,
    "eoiRules" JSONB,
    "permissions" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_token_key" ON "PasswordResetToken"("token");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_token_idx" ON "PasswordResetToken"("token");

CREATE INDEX IF NOT EXISTS "Lead_intentType_idx" ON "Lead"("intentType");
CREATE INDEX IF NOT EXISTS "Lead_customerEmail_projectId_cpId_idx" ON "Lead"("customerEmail", "projectId", "cpId");

CREATE UNIQUE INDEX IF NOT EXISTS "EOIRule_projectId_key" ON "EOIRule"("projectId");

CREATE INDEX IF NOT EXISTS "EmailLog_status_createdAt_idx" ON "EmailLog"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "EmailLog_entityType_entityId_idx" ON "EmailLog"("entityType", "entityId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
