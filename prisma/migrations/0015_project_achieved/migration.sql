ALTER TABLE "Project"
  ADD COLUMN "achievedAt" TIMESTAMP(3);

CREATE INDEX "Project_achievedAt_createdAt_idx" ON "Project"("achievedAt", "createdAt");
