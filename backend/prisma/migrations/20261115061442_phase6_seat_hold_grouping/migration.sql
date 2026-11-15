-- AlterTable
ALTER TABLE "SeatHold" ADD COLUMN     "holdId" TEXT;

-- CreateIndex
CREATE INDEX "SeatHold_holdId_idx" ON "SeatHold"("holdId");
