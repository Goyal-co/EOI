-- AlterTable
CREATE TYPE "CPTeamJobRole" AS ENUM ('SALES_EXECUTIVE', 'TEAM_LEADER');

ALTER TABLE "CPTeamMember" ADD COLUMN "jobRole" "CPTeamJobRole" NOT NULL DEFAULT 'SALES_EXECUTIVE';
ALTER TABLE "CPTeamMember" ADD COLUMN "teamLeaderId" TEXT;

-- Backfill jobRole from free-text role
UPDATE "CPTeamMember"
SET "jobRole" = 'TEAM_LEADER'
WHERE lower(coalesce("role", '')) IN ('team lead', 'team leader', 'tl');

UPDATE "CPTeamMember"
SET "role" = CASE
  WHEN "jobRole" = 'TEAM_LEADER' THEN 'Team Leader'
  ELSE 'Sales Executive'
END;

-- CreateIndex
CREATE INDEX "CPTeamMember_cpId_jobRole_idx" ON "CPTeamMember"("cpId", "jobRole");
CREATE INDEX "CPTeamMember_teamLeaderId_idx" ON "CPTeamMember"("teamLeaderId");

-- AddForeignKey
ALTER TABLE "CPTeamMember" ADD CONSTRAINT "CPTeamMember_teamLeaderId_fkey" FOREIGN KEY ("teamLeaderId") REFERENCES "CPTeamMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
