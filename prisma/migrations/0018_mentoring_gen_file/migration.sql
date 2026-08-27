-- CreateTable
CREATE TABLE "MentoringGenFile" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "fileKey" TEXT NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MentoringGenFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MentoringGenFile_courseId_studentId_kind_createdAt_idx" ON "MentoringGenFile"("courseId", "studentId", "kind", "createdAt");
