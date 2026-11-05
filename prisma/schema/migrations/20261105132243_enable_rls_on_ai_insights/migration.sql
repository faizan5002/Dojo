-- Enable Row Level Security on ai_insights, created by the migration just
-- before this one. Prisma connects as the table owner, which RLS never gates;
-- with no policies, the Data API roles read nothing. No policies, never FORCE.
-- Hand-written on purpose: RLS is not expressible in the Prisma schema
-- (docs/rules/auth.md).
ALTER TABLE "ai_insights" ENABLE ROW LEVEL SECURITY;
