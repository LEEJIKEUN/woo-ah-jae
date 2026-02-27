-- CreateTable
CREATE TABLE IF NOT EXISTS "BoardChannel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BoardPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "boardChannelId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "categoryTag" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "attachments" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "isNotice" BOOLEAN NOT NULL DEFAULT false,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BoardPost_boardChannelId_fkey" FOREIGN KEY ("boardChannelId") REFERENCES "BoardChannel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BoardPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BoardComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "parentCommentId" TEXT,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BoardComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "BoardPost" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BoardComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BoardComment_parentCommentId_fkey" FOREIGN KEY ("parentCommentId") REFERENCES "BoardComment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BoardPostLike" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BoardPostLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "BoardPost" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BoardPostLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BoardReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BoardReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BoardPostView" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "userId" TEXT,
    "viewerKey" TEXT NOT NULL,
    "lastViewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BoardPostView_postId_fkey" FOREIGN KEY ("postId") REFERENCES "BoardPost" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BoardPostView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BoardChannel_slug_key" ON "BoardChannel"("slug");
CREATE INDEX IF NOT EXISTS "BoardPost_boardChannelId_status_createdAt_idx" ON "BoardPost"("boardChannelId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "BoardPost_boardChannelId_isPinned_isNotice_createdAt_idx" ON "BoardPost"("boardChannelId", "isPinned", "isNotice", "createdAt");
CREATE INDEX IF NOT EXISTS "BoardPost_authorId_createdAt_idx" ON "BoardPost"("authorId", "createdAt");
CREATE INDEX IF NOT EXISTS "BoardComment_postId_createdAt_idx" ON "BoardComment"("postId", "createdAt");
CREATE INDEX IF NOT EXISTS "BoardComment_authorId_createdAt_idx" ON "BoardComment"("authorId", "createdAt");
CREATE INDEX IF NOT EXISTS "BoardComment_parentCommentId_idx" ON "BoardComment"("parentCommentId");
CREATE UNIQUE INDEX IF NOT EXISTS "BoardPostLike_postId_userId_key" ON "BoardPostLike"("postId", "userId");
CREATE INDEX IF NOT EXISTS "BoardPostLike_userId_createdAt_idx" ON "BoardPostLike"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "BoardReport_targetType_targetId_createdAt_idx" ON "BoardReport"("targetType", "targetId", "createdAt");
CREATE INDEX IF NOT EXISTS "BoardReport_reporterId_createdAt_idx" ON "BoardReport"("reporterId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "BoardPostView_postId_viewerKey_key" ON "BoardPostView"("postId", "viewerKey");
CREATE INDEX IF NOT EXISTS "BoardPostView_userId_lastViewedAt_idx" ON "BoardPostView"("userId", "lastViewedAt");
