-- Unique normalized RERA + Support Tickets

-- Notification types for support
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SUPPORT_TICKET_CREATED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SUPPORT_MESSAGE';

CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');
CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "SupportTicketCategory" AS ENUM ('PORTAL_LOGIN', 'LEAD_EOI', 'PROJECT_INFO', 'COMMISSION', 'OTHER');

-- RERA uniqueness
ALTER TABLE "ChannelPartner" ADD COLUMN IF NOT EXISTS "reraNormalized" TEXT;

UPDATE "ChannelPartner"
SET "reraNormalized" = UPPER(REGEXP_REPLACE(TRIM("reraNumber"), '[^A-Za-z0-9]+', '', 'g'))
WHERE "reraNormalized" IS NULL;

-- Disambiguate existing duplicates: keep earliest, suffix later rows
WITH ranked AS (
  SELECT id,
    "reraNormalized",
    ROW_NUMBER() OVER (PARTITION BY "reraNormalized" ORDER BY "createdAt" ASC, id ASC) AS rn
  FROM "ChannelPartner"
  WHERE "reraNormalized" IS NOT NULL AND "reraNormalized" <> ''
)
UPDATE "ChannelPartner" cp
SET "reraNormalized" = cp."reraNormalized" || '#DUP' || SUBSTRING(cp.id FROM 1 FOR 8)
FROM ranked r
WHERE cp.id = r.id AND r.rn > 1;

UPDATE "ChannelPartner"
SET "reraNormalized" = 'MISSING#' || SUBSTRING(id FROM 1 FOR 8)
WHERE "reraNormalized" IS NULL OR "reraNormalized" = '';

ALTER TABLE "ChannelPartner" ALTER COLUMN "reraNormalized" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "ChannelPartner_reraNormalized_key" ON "ChannelPartner"("reraNormalized");

-- Support tickets
CREATE TABLE IF NOT EXISTS "SupportTicket" (
  "id" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "cpId" TEXT NOT NULL,
  "category" "SupportTicketCategory" NOT NULL,
  "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "SupportTicketPriority" NOT NULL DEFAULT 'MEDIUM',
  "assignedAdminId" TEXT,
  "projectId" TEXT,
  "source" TEXT NOT NULL DEFAULT 'PARTNER_PORTAL',
  "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SupportTicket_number_key" ON "SupportTicket"("number");
CREATE INDEX IF NOT EXISTS "SupportTicket_status_lastMessageAt_idx" ON "SupportTicket"("status", "lastMessageAt");
CREATE INDEX IF NOT EXISTS "SupportTicket_cpId_status_idx" ON "SupportTicket"("cpId", "status");
CREATE INDEX IF NOT EXISTS "SupportTicket_assignedAdminId_idx" ON "SupportTicket"("assignedAdminId");

CREATE TABLE IF NOT EXISTS "SupportMessage" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "senderUserId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "attachmentUrl" TEXT,
  "attachmentName" TEXT,
  "attachmentSize" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readByPartnerAt" TIMESTAMP(3),
  "readByAdminAt" TIMESTAMP(3),
  CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SupportMessage_ticketId_createdAt_idx" ON "SupportMessage"("ticketId", "createdAt");
CREATE INDEX IF NOT EXISTS "SupportMessage_senderUserId_idx" ON "SupportMessage"("senderUserId");

DO $$ BEGIN
  ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_cpId_fkey"
    FOREIGN KEY ("cpId") REFERENCES "ChannelPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_assignedAdminId_fkey"
    FOREIGN KEY ("assignedAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_senderUserId_fkey"
    FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
