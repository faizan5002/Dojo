-- AlterTable
ALTER TABLE "users" ADD COLUMN     "name" TEXT;

-- CreateTable
CREATE TABLE "uploads" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "files" JSONB NOT NULL,
    "session_count" INTEGER NOT NULL,
    "prompt_count" INTEGER NOT NULL,
    "redaction_count" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_sessions" (
    "id" UUID NOT NULL,
    "upload_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "external_id" TEXT NOT NULL,
    "agent" TEXT NOT NULL,
    "project" TEXT,
    "generated_at" TEXT,
    "started_at" TIMESTAMPTZ(6),
    "prompt_count" INTEGER NOT NULL,
    "turns" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upload_metrics" (
    "id" UUID NOT NULL,
    "upload_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "session_count" INTEGER NOT NULL,
    "prompt_count" INTEGER NOT NULL,
    "response_count" INTEGER NOT NULL,
    "average_prompt_words" DOUBLE PRECISION,
    "paste_ratio" DOUBLE PRECISION,
    "prompt_to_response_ratio" DOUBLE PRECISION,
    "average_gap_minutes" DOUBLE PRECISION,
    "longest_gap_minutes" DOUBLE PRECISION,
    "code_blocks_per_prompt" DOUBLE PRECISION,
    "file_paths_per_prompt" DOUBLE PRECISION,
    "urls_per_prompt" DOUBLE PRECISION,
    "sessions" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "upload_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "upload_id" UUID NOT NULL,
    "rubric_version" TEXT NOT NULL,
    "overall_score" INTEGER,
    "proficiency" TEXT,
    "skills_assessed" INTEGER NOT NULL,
    "strongest_skill" TEXT,
    "weakest_skill" TEXT,
    "session_count" INTEGER NOT NULL,
    "prompt_count" INTEGER NOT NULL,
    "redaction_count" INTEGER NOT NULL,
    "profile" JSONB NOT NULL,
    "recommendations" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_assessments" (
    "id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "skill" TEXT NOT NULL,
    "score" INTEGER,
    "proficiency" TEXT,
    "confidence" TEXT NOT NULL,
    "observations" INTEGER NOT NULL,
    "tallies" JSONB NOT NULL,
    "evidence" JSONB NOT NULL,

    CONSTRAINT "skill_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "uploads_user_id_created_at_idx" ON "uploads"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_sessions_user_id_idx" ON "agent_sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_sessions_upload_id_external_id_key" ON "agent_sessions"("upload_id", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "upload_metrics_upload_id_key" ON "upload_metrics"("upload_id");

-- CreateIndex
CREATE INDEX "upload_metrics_user_id_idx" ON "upload_metrics"("user_id");

-- CreateIndex
CREATE INDEX "assessments_user_id_created_at_idx" ON "assessments"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "assessments_upload_id_idx" ON "assessments"("upload_id");

-- CreateIndex
CREATE INDEX "skill_assessments_user_id_idx" ON "skill_assessments"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "skill_assessments_assessment_id_skill_key" ON "skill_assessments"("assessment_id", "skill");

-- AddForeignKey
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "uploads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_metrics" ADD CONSTRAINT "upload_metrics_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "uploads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_metrics" ADD CONSTRAINT "upload_metrics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "uploads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_assessments" ADD CONSTRAINT "skill_assessments_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_assessments" ADD CONSTRAINT "skill_assessments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
