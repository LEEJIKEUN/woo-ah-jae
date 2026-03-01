-- Create enum
CREATE TYPE "MaintenanceStatus" AS ENUM ('IDLE', 'SCHEDULED', 'ACTIVE');

-- Create table
CREATE TABLE "Maintenance" (
  "id" TEXT NOT NULL,
  "status" "MaintenanceStatus" NOT NULL DEFAULT 'IDLE',
  "lockAt" TIMESTAMPTZ,
  "messageKor" TEXT,
  "updatedBy" TEXT,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Maintenance_pkey" PRIMARY KEY ("id")
);
