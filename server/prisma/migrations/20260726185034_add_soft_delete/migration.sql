-- DropIndex
DROP INDEX "cards_projectId_idx";

-- AlterTable
ALTER TABLE "cards" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "connections" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "cards_projectId_deletedAt_idx" ON "cards"("projectId", "deletedAt");
