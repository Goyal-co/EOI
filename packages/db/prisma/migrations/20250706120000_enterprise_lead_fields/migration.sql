-- Enterprise lead cross-system fields
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "leadId" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "titanCrmId" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "bookingLeadId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Lead_leadId_key" ON "Lead"("leadId");
