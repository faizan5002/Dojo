-- Deny-by-default lock on the challenge library, like every other table: RLS
-- on, no policies, not forced (Prisma connects as the owner). See docs/rules/auth.md.
ALTER TABLE "practice_challenges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "practice_challenge_versions" ENABLE ROW LEVEL SECURITY;
