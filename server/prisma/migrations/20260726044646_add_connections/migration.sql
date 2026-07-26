-- CreateTable
CREATE TABLE "connections" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceCardId" TEXT NOT NULL,
    "targetCardId" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#64748b',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "connections_projectId_idx" ON "connections"("projectId");

-- CreateIndex
CREATE INDEX "connections_targetCardId_idx" ON "connections"("targetCardId");

-- CreateIndex
CREATE UNIQUE INDEX "connections_sourceCardId_targetCardId_key" ON "connections"("sourceCardId", "targetCardId");

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_sourceCardId_fkey" FOREIGN KEY ("sourceCardId") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_targetCardId_fkey" FOREIGN KEY ("targetCardId") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
