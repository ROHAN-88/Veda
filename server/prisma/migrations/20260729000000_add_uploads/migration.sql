-- CreateTable
CREATE TABLE "uploads" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uploads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "uploads_ownerId_idx" ON "uploads"("ownerId");

-- AddForeignKey
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
