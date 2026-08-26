-- CreateTable
CREATE TABLE "MentoringAiEval" (
    "courseId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "evalText" TEXT NOT NULL DEFAULT '',
    "aiText" TEXT NOT NULL DEFAULT '',
    "byteCount" INTEGER NOT NULL DEFAULT 0,
    "dossier" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "editedBy" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentoringAiEval_pkey" PRIMARY KEY ("courseId","studentId")
);
