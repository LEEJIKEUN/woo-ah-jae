-- Board grouping without parent-child hierarchy
CREATE TABLE IF NOT EXISTS "BoardGroup" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "communityKey" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

ALTER TABLE "BoardChannel" ADD COLUMN "communityKey" TEXT NOT NULL DEFAULT 'exam-community';
ALTER TABLE "BoardChannel" ADD COLUMN "groupId" TEXT;
ALTER TABLE "BoardChannel" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BoardChannel" ADD COLUMN "isNotice" BOOLEAN NOT NULL DEFAULT false;

DROP INDEX IF EXISTS "BoardChannel_slug_key";
CREATE UNIQUE INDEX IF NOT EXISTS "BoardChannel_slug_key" ON "BoardChannel"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "BoardChannel_communityKey_slug_key" ON "BoardChannel"("communityKey", "slug");
CREATE INDEX IF NOT EXISTS "BoardChannel_communityKey_sortOrder_idx" ON "BoardChannel"("communityKey", "sortOrder");
CREATE INDEX IF NOT EXISTS "BoardChannel_communityKey_groupId_sortOrder_idx" ON "BoardChannel"("communityKey", "groupId", "sortOrder");

CREATE UNIQUE INDEX IF NOT EXISTS "BoardGroup_communityKey_name_key" ON "BoardGroup"("communityKey", "name");
CREATE INDEX IF NOT EXISTS "BoardGroup_communityKey_sortOrder_idx" ON "BoardGroup"("communityKey", "sortOrder");
