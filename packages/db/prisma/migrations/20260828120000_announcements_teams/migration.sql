-- EOI_CP: team members + announcements (separate from Booking_Inventory Announcement table)

-- Enums
DO $$ BEGIN
  CREATE TYPE "AnnouncementAudience" AS ENUM ('ALL', 'ADMINS', 'CHANNEL_PARTNERS', 'CUSTOMERS', 'PROJECT_CPS', 'PROJECT_CUSTOMERS');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AnnouncementStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AnnouncementChannel" AS ENUM ('IN_APP', 'EMAIL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CPTeamMemberStatus" AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ANNOUNCEMENT notification type
DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ANNOUNCEMENT';
EXCEPTION WHEN others THEN NULL;
END $$;

-- CPTeamMember
CREATE TABLE IF NOT EXISTS "CPTeamMember" (
  "id" TEXT NOT NULL,
  "cpId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "mobile" TEXT,
  "role" TEXT,
  "status" "CPTeamMemberStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CPTeamMember_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CPTeamMember_cpId_status_idx" ON "CPTeamMember"("cpId", "status");

DO $$ BEGIN
  ALTER TABLE "CPTeamMember" ADD CONSTRAINT "CPTeamMember_cpId_fkey"
    FOREIGN KEY ("cpId") REFERENCES "ChannelPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Lead.teamMemberId
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "teamMemberId" TEXT;
CREATE INDEX IF NOT EXISTS "Lead_teamMemberId_idx" ON "Lead"("teamMemberId");

DO $$ BEGIN
  ALTER TABLE "Lead" ADD CONSTRAINT "Lead_teamMemberId_fkey"
    FOREIGN KEY ("teamMemberId") REFERENCES "CPTeamMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- EoiAnnouncement tables
CREATE TABLE IF NOT EXISTS "EoiAnnouncement" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "audience" "AnnouncementAudience" NOT NULL,
  "channels" "AnnouncementChannel"[] DEFAULT ARRAY['IN_APP']::"AnnouncementChannel"[],
  "projectId" TEXT,
  "status" "AnnouncementStatus" NOT NULL DEFAULT 'DRAFT',
  "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
  "scheduledAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EoiAnnouncement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EoiAnnouncement_status_scheduledAt_idx" ON "EoiAnnouncement"("status", "scheduledAt");
CREATE INDEX IF NOT EXISTS "EoiAnnouncement_audience_idx" ON "EoiAnnouncement"("audience");
CREATE INDEX IF NOT EXISTS "EoiAnnouncement_projectId_idx" ON "EoiAnnouncement"("projectId");

DO $$ BEGIN
  ALTER TABLE "EoiAnnouncement" ADD CONSTRAINT "EoiAnnouncement_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "EoiAnnouncement" ADD CONSTRAINT "EoiAnnouncement_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "EoiAnnouncementAttachment" (
  "id" TEXT NOT NULL,
  "announcementId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "mimeType" TEXT,
  "fileSize" INTEGER,
  "kind" TEXT NOT NULL,
  CONSTRAINT "EoiAnnouncementAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EoiAnnouncementAttachment_announcementId_idx" ON "EoiAnnouncementAttachment"("announcementId");

DO $$ BEGIN
  ALTER TABLE "EoiAnnouncementAttachment" ADD CONSTRAINT "EoiAnnouncementAttachment_announcementId_fkey"
    FOREIGN KEY ("announcementId") REFERENCES "EoiAnnouncement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "EoiAnnouncementDelivery" (
  "id" TEXT NOT NULL,
  "announcementId" TEXT NOT NULL,
  "userId" TEXT,
  "email" TEXT,
  "channel" "AnnouncementChannel" NOT NULL,
  "status" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3),
  CONSTRAINT "EoiAnnouncementDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EoiAnnouncementDelivery_announcementId_idx" ON "EoiAnnouncementDelivery"("announcementId");
CREATE INDEX IF NOT EXISTS "EoiAnnouncementDelivery_userId_idx" ON "EoiAnnouncementDelivery"("userId");

DO $$ BEGIN
  ALTER TABLE "EoiAnnouncementDelivery" ADD CONSTRAINT "EoiAnnouncementDelivery_announcementId_fkey"
    FOREIGN KEY ("announcementId") REFERENCES "EoiAnnouncement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
