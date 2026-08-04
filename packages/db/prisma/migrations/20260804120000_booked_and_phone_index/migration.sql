-- AlterEnum LeadStatus +BOOKED
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'BOOKED';

-- AlterEnum CustomerJourneyStatus +BOOKED
ALTER TYPE "CustomerJourneyStatus" ADD VALUE IF NOT EXISTS 'BOOKED';

-- Index for phone lock lookups
CREATE INDEX IF NOT EXISTS "Lead_customerMobile_createdAt_idx" ON "Lead"("customerMobile", "createdAt");
