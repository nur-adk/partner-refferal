-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "apolloId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Lead_apolloId_key" ON "Lead"("apolloId");

