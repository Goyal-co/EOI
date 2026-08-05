-- One public Lead ID represents the same customer across multiple projects.
DROP INDEX IF EXISTS "Lead_leadId_key";

CREATE INDEX IF NOT EXISTS "Lead_leadId_idx" ON "Lead"("leadId");
CREATE INDEX IF NOT EXISTS "Lead_customerEmail_createdAt_idx"
  ON "Lead"("customerEmail", "createdAt");
