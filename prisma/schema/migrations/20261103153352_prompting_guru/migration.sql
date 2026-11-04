-- CreateTable
CREATE TABLE "practice_attempts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "assessment_id" UUID,
    "challenge_id" TEXT NOT NULL,
    "challenge_version" INTEGER NOT NULL,
    "skill" TEXT NOT NULL,
    "exercise_type" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "band" TEXT NOT NULL,
    "evaluator" TEXT NOT NULL,
    "evaluation" JSONB NOT NULL,
    "review_after" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "practice_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "practice_attempts_user_id_created_at_idx" ON "practice_attempts"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "practice_attempts_user_id_challenge_id_created_at_idx" ON "practice_attempts"("user_id", "challenge_id", "created_at");

-- CreateIndex
CREATE INDEX "practice_attempts_assessment_id_idx" ON "practice_attempts"("assessment_id");

-- AddForeignKey
ALTER TABLE "practice_attempts" ADD CONSTRAINT "practice_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_attempts" ADD CONSTRAINT "practice_attempts_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
