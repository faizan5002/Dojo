-- Enable Row Level Security on practice_attempts, created by the migration
-- just before this one. Prisma connects as the table owner, which RLS never
-- gates; with no policies, any gated role (the Data API's anon and
-- authenticated roles) reads nothing. No policies, never FORCE. Hand-written on
-- purpose: RLS is not expressible in the Prisma schema (docs/rules/auth.md).
ALTER TABLE "practice_attempts" ENABLE ROW LEVEL SECURITY;
