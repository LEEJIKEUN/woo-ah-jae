-- CreateTable
CREATE TABLE IF NOT EXISTS "WorkspaceConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "googleSheetUrl" TEXT,
    "zoomMeetingUrl" TEXT,
    "pinnedNotice" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkspaceConfig_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TEXT',
    "fileUrl" TEXT,
    "fileName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WorkspaceFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkspaceFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkspaceFile_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TodoItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TodoItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TodoItem_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceConfig_projectId_key" ON "WorkspaceConfig"("projectId");
CREATE INDEX IF NOT EXISTS "ChatMessage_projectId_createdAt_idx" ON "ChatMessage"("projectId", "createdAt");
CREATE INDEX IF NOT EXISTS "ChatMessage_userId_createdAt_idx" ON "ChatMessage"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "WorkspaceFile_projectId_createdAt_idx" ON "WorkspaceFile"("projectId", "createdAt");
CREATE INDEX IF NOT EXISTS "WorkspaceFile_uploaderId_createdAt_idx" ON "WorkspaceFile"("uploaderId", "createdAt");
CREATE INDEX IF NOT EXISTS "TodoItem_projectId_createdAt_idx" ON "TodoItem"("projectId", "createdAt");
CREATE INDEX IF NOT EXISTS "TodoItem_creatorId_createdAt_idx" ON "TodoItem"("creatorId", "createdAt");

-- Backfill accepted applicants into ProjectMember for existing data.
INSERT INTO "ProjectMember" ("id", "projectId", "userId", "roleInTeam", "joinedAt")
SELECT lower(hex(randomblob(16))), a."projectId", a."applicantId", NULL, CURRENT_TIMESTAMP
FROM "Application" a
LEFT JOIN "ProjectMember" pm
  ON pm."projectId" = a."projectId" AND pm."userId" = a."applicantId"
WHERE a."status" = 'ACCEPTED' AND pm."id" IS NULL;
