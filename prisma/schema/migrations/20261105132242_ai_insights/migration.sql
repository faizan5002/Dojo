-- CreateTable
CREATE TABLE "ai_insights" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "feature" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "input_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error_code" TEXT,
    "output" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_insights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_insights_user_id_feature_subject_id_created_at_idx" ON "ai_insights"("user_id", "feature", "subject_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_insights_user_id_created_at_idx" ON "ai_insights"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "ai_insights" ADD CONSTRAINT "ai_insights_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
