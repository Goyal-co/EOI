-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "LeadEventType" AS ENUM (
    'PUNCHED',
    'MAPPED',
    'CONFIRMED',
    'REJECTED',
    'SITE_VISIT',
    'BOOKED',
    'LOCK_STARTED',
    'CP_ATTACHED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable LeadIdentity
CREATE TABLE IF NOT EXISTS "LeadIdentity" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "primaryPhone" TEXT NOT NULL,
  "primaryEmail" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadIdentity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LeadIdentity_leadId_key" ON "LeadIdentity"("leadId");
CREATE INDEX IF NOT EXISTS "LeadIdentity_primaryPhone_idx" ON "LeadIdentity"("primaryPhone");
CREATE INDEX IF NOT EXISTS "LeadIdentity_primaryEmail_idx" ON "LeadIdentity"("primaryEmail");

-- CreateTable LeadEvent
CREATE TABLE IF NOT EXISTS "LeadEvent" (
  "id" TEXT NOT NULL,
  "identityId" TEXT NOT NULL,
  "leadId" TEXT,
  "cpId" TEXT,
  "projectId" TEXT,
  "type" "LeadEventType" NOT NULL,
  "actorType" TEXT,
  "metadata" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LeadEvent_identityId_occurredAt_idx" ON "LeadEvent"("identityId", "occurredAt");
CREATE INDEX IF NOT EXISTS "LeadEvent_type_idx" ON "LeadEvent"("type");
CREATE INDEX IF NOT EXISTS "LeadEvent_leadId_idx" ON "LeadEvent"("leadId");
CREATE INDEX IF NOT EXISTS "LeadEvent_cpId_idx" ON "LeadEvent"("cpId");

-- AlterTable Lead
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "identityId" TEXT;
CREATE INDEX IF NOT EXISTS "Lead_identityId_idx" ON "Lead"("identityId");

-- Backfill LeadIdentity from existing Lead rows (group by public leadId, else phone+email)
INSERT INTO "LeadIdentity" ("id", "leadId", "primaryPhone", "primaryEmail", "createdAt", "updatedAt")
SELECT
  md5(grouped."leadId" || ':' || grouped."primaryPhone" || ':' || grouped."primaryEmail"),
  grouped."leadId",
  grouped."primaryPhone",
  grouped."primaryEmail",
  grouped."createdAt",
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT ON (COALESCE("leadId", "customerMobile" || '|' || lower("customerEmail")))
    COALESCE(
      "leadId",
      'LEGACY-' || upper(substr(md5("customerMobile" || lower("customerEmail")), 1, 10))
    ) AS "leadId",
    "customerMobile" AS "primaryPhone",
    lower("customerEmail") AS "primaryEmail",
    "createdAt"
  FROM "Lead"
  WHERE "customerMobile" IS NOT NULL AND "customerEmail" IS NOT NULL
  ORDER BY COALESCE("leadId", "customerMobile" || '|' || lower("customerEmail")), "createdAt" ASC
) grouped
ON CONFLICT ("leadId") DO NOTHING;

-- Link leads to identities by public leadId
UPDATE "Lead" l
SET "identityId" = i."id",
    "leadId" = COALESCE(l."leadId", i."leadId")
FROM "LeadIdentity" i
WHERE l."identityId" IS NULL
  AND l."leadId" IS NOT NULL
  AND l."leadId" = i."leadId";

-- Link remaining by phone+email
UPDATE "Lead" l
SET "identityId" = i."id",
    "leadId" = COALESCE(l."leadId", i."leadId")
FROM "LeadIdentity" i
WHERE l."identityId" IS NULL
  AND l."customerMobile" = i."primaryPhone"
  AND lower(l."customerEmail") = i."primaryEmail";

-- Seed PUNCHED events for existing associations (idempotent-ish: only if none exist for lead)
INSERT INTO "LeadEvent" ("id", "identityId", "leadId", "cpId", "projectId", "type", "actorType", "metadata", "occurredAt", "createdAt")
SELECT
  md5('punch:' || l."id"),
  l."identityId",
  l."id",
  l."cpId",
  l."projectId",
  'PUNCHED'::"LeadEventType",
  'SYSTEM',
  jsonb_build_object('backfill', true, 'intentType', l."intentType"::text),
  l."createdAt",
  CURRENT_TIMESTAMP
FROM "Lead" l
WHERE l."identityId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "LeadEvent" e WHERE e."leadId" = l."id" AND e."type" = 'PUNCHED'
  );

-- FKs
DO $$ BEGIN
  ALTER TABLE "Lead" ADD CONSTRAINT "Lead_identityId_fkey"
    FOREIGN KEY ("identityId") REFERENCES "LeadIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "LeadEvent" ADD CONSTRAINT "LeadEvent_identityId_fkey"
    FOREIGN KEY ("identityId") REFERENCES "LeadIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "LeadEvent" ADD CONSTRAINT "LeadEvent_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "LeadEvent" ADD CONSTRAINT "LeadEvent_cpId_fkey"
    FOREIGN KEY ("cpId") REFERENCES "ChannelPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "LeadEvent" ADD CONSTRAINT "LeadEvent_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
