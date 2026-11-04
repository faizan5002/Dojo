-- CreateEnum
CREATE TYPE "practice_skill" AS ENUM ('promptClarity', 'planning', 'verification', 'iteration', 'scopeControl');

-- CreateEnum
CREATE TYPE "practice_difficulty" AS ENUM ('beginner', 'intermediate', 'advanced');

-- CreateEnum
CREATE TYPE "practice_exercise_type" AS ENUM ('improveVaguePrompt', 'planBeforeCoding', 'verifyOutput', 'improveIteration', 'controlScope');

-- AlterTable
ALTER TABLE "practice_attempts" ADD COLUMN     "challenge_version_id" UUID;

-- CreateTable
CREATE TABLE "practice_challenges" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "skill" "practice_skill" NOT NULL,
    "exercise_type" "practice_exercise_type" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "current_version_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "practice_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_challenge_versions" (
    "id" UUID NOT NULL,
    "challenge_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "difficulty" "practice_difficulty" NOT NULL,
    "scenario" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "given_label" TEXT,
    "given_text" TEXT,
    "criteria" JSONB NOT NULL,
    "pitfalls" JSONB NOT NULL,
    "exemplar" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "estimated_minutes" INTEGER NOT NULL,
    "tags" TEXT[],
    "content_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "practice_challenge_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "practice_challenges_slug_key" ON "practice_challenges"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "practice_challenges_current_version_id_key" ON "practice_challenges"("current_version_id");

-- CreateIndex
CREATE INDEX "practice_challenges_skill_is_active_idx" ON "practice_challenges"("skill", "is_active");

-- CreateIndex
CREATE INDEX "practice_challenges_exercise_type_is_active_idx" ON "practice_challenges"("exercise_type", "is_active");

-- CreateIndex
CREATE INDEX "practice_challenge_versions_difficulty_idx" ON "practice_challenge_versions"("difficulty");

-- CreateIndex
CREATE UNIQUE INDEX "practice_challenge_versions_challenge_id_version_key" ON "practice_challenge_versions"("challenge_id", "version");

-- CreateIndex
CREATE INDEX "practice_attempts_challenge_version_id_idx" ON "practice_attempts"("challenge_version_id");

-- AddForeignKey
ALTER TABLE "practice_challenges" ADD CONSTRAINT "practice_challenges_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "practice_challenge_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_challenge_versions" ADD CONSTRAINT "practice_challenge_versions_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "practice_challenges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_attempts" ADD CONSTRAINT "practice_attempts_challenge_version_id_fkey" FOREIGN KEY ("challenge_version_id") REFERENCES "practice_challenge_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
