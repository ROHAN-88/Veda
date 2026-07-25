-- CreateTable
CREATE TABLE "cards" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "w" DOUBLE PRECISION NOT NULL DEFAULT 240,
    "h" DOUBLE PRECISION NOT NULL DEFAULT 160,
    "content" TEXT NOT NULL DEFAULT '',
    "zIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cards_projectId_idx" ON "cards"("projectId");

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
