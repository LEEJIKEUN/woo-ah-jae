-- AlterTable
ALTER TABLE "StudentProfile"
ADD COLUMN "residenceCountry" TEXT,
ADD COLUMN "birthDate" TIMESTAMP(3),
ALTER COLUMN "className" DROP NOT NULL,
ALTER COLUMN "number" DROP NOT NULL;
