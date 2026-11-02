-- Enable Row Level Security on the workspace tables, created by the migration
-- just before this one. Prisma connects as the table owner, which RLS never
-- gates, so the app is unaffected; with no policies, any role that is gated
-- (the Data API's anon and authenticated roles) reads nothing. No policies,
-- never FORCE. Hand-written on purpose: RLS is not expressible in the Prisma
-- schema (docs/rules/auth.md, docs/rules/migrations.md).
ALTER TABLE "uploads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agent_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "upload_metrics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "assessments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "skill_assessments" ENABLE ROW LEVEL SECURITY;
