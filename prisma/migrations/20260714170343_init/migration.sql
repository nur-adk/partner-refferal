-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "linkedinUrl" TEXT,
    "email" TEXT,
    "personalWebsite" TEXT,
    "companyWebsite" TEXT,
    "summary" TEXT,
    "university" TEXT,
    "pastEmployers" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "country" TEXT NOT NULL DEFAULT 'US',
    "similarToLinkedinUrl" TEXT,
    "similarToResult" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DecisionMaker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "education" TEXT,
    "pastEmployers" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Lead_country_idx" ON "Lead"("country");

-- CreateIndex
CREATE INDEX "Lead_source_idx" ON "Lead"("source");
