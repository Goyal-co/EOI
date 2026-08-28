-- CP team member portal login (shared partner dashboard, scoped access)

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'CP_TEAM_MEMBER';

ALTER TABLE "CPTeamMember" ADD COLUMN IF NOT EXISTS "userId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "CPTeamMember_userId_key" ON "CPTeamMember"("userId");

DO $$ BEGIN
  ALTER TABLE "CPTeamMember" ADD CONSTRAINT "CPTeamMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
