-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SeatCategory" ADD VALUE 'REGULAR';
ALTER TYPE "SeatCategory" ADD VALUE 'RECLINER';

-- AlterTable
ALTER TABLE "Screen" ADD COLUMN     "capacity" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Seat" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Theatre" ADD COLUMN     "address" TEXT,
ADD COLUMN     "city" TEXT;

-- Backfill screen capacity from existing physical seats
UPDATE "Screen" SET "capacity" = (
  SELECT COUNT(*) FROM "Seat" WHERE "Seat"."screenId" = "Screen"."id"
);

-- Backfill city and address for existing theatres
UPDATE "Theatre"
SET "city" = 'Bengaluru', "address" = "location"
WHERE "city" IS NULL;
