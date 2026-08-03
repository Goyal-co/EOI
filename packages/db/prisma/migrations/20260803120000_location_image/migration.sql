-- AlterEnum DocumentType
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'LOCATION';

-- AlterTable Project
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "locationImageUrl" TEXT;
