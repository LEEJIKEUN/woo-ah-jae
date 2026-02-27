CREATE TABLE IF NOT EXISTS "WorkspaceSchedule" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "creatorId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "note" TEXT,
  "date" DATETIME NOT NULL,
  "done" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS "WorkspaceSchedule_projectId_date_idx" ON "WorkspaceSchedule"("projectId", "date");
CREATE INDEX IF NOT EXISTS "WorkspaceSchedule_projectId_done_date_idx" ON "WorkspaceSchedule"("projectId", "done", "date");
CREATE INDEX IF NOT EXISTS "WorkspaceSchedule_creatorId_createdAt_idx" ON "WorkspaceSchedule"("creatorId", "createdAt");
