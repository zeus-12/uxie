-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('PDF', 'ARTICLE');

-- CreateEnum
CREATE TYPE "ArticleIngestionStatus" AS ENUM ('PROCESSING', 'READY', 'UNSUPPORTED', 'FAILED');

-- AlterEnum
ALTER TYPE "HighlightTypeEnum" ADD VALUE 'ARTICLE_TEXT';

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "kind" "DocumentKind" NOT NULL DEFAULT 'PDF';

-- AlterTable
ALTER TABLE "Highlight" ADD COLUMN     "selectedText" TEXT;

-- CreateTable
CREATE TABLE "ArticleDocument" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "canonicalUrl" TEXT NOT NULL,
    "siteName" TEXT,
    "byline" TEXT,
    "excerpt" TEXT,
    "wordCount" INTEGER NOT NULL,
    "status" "ArticleIngestionStatus" NOT NULL DEFAULT 'PROCESSING',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleSnapshot" (
    "id" TEXT NOT NULL,
    "articleDocumentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentHtml" TEXT NOT NULL,
    "textContent" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleProgress" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "blockId" TEXT,
    "characterOffset" INTEGER NOT NULL DEFAULT 0,
    "scrollFraction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleTextAnchor" (
    "id" TEXT NOT NULL,
    "highlightId" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "startOffset" INTEGER NOT NULL,
    "endOffset" INTEGER NOT NULL,
    "prefix" TEXT NOT NULL,
    "suffix" TEXT NOT NULL,
    "exactText" TEXT NOT NULL,

    CONSTRAINT "ArticleTextAnchor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArticleDocument_documentId_key" ON "ArticleDocument"("documentId");

-- CreateIndex
CREATE INDEX "ArticleSnapshot_articleDocumentId_createdAt_idx" ON "ArticleSnapshot"("articleDocumentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleProgress_documentId_userId_key" ON "ArticleProgress"("documentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleTextAnchor_highlightId_key" ON "ArticleTextAnchor"("highlightId");

-- AddForeignKey
ALTER TABLE "ArticleDocument" ADD CONSTRAINT "ArticleDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleSnapshot" ADD CONSTRAINT "ArticleSnapshot_articleDocumentId_fkey" FOREIGN KEY ("articleDocumentId") REFERENCES "ArticleDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleProgress" ADD CONSTRAINT "ArticleProgress_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleProgress" ADD CONSTRAINT "ArticleProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleTextAnchor" ADD CONSTRAINT "ArticleTextAnchor_highlightId_fkey" FOREIGN KEY ("highlightId") REFERENCES "Highlight"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleTextAnchor" ADD CONSTRAINT "ArticleTextAnchor_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "ArticleSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
