-- Member lifecycle and project soft-delete recovery
CREATE TYPE "UserLifecycleStatus" AS ENUM ('ACTIVE', 'DELETED', 'ACHIEVED');

ALTER TABLE "User"
  ADD COLUMN "lifecycleStatus" "UserLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "achievedAt" TIMESTAMP(3);

ALTER TABLE "Project"
  ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "deletedBy" TEXT;

CREATE INDEX "Project_isDeleted_createdAt_idx" ON "Project"("isDeleted", "createdAt");
