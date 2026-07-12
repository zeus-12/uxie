/*
  Warnings:

  - You are about to drop the column `userId` on the `Highlight` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Cordinate" DROP CONSTRAINT "Cordinate_highlightedBoundingRectangleId_fkey";

-- DropForeignKey
ALTER TABLE "Cordinate" DROP CONSTRAINT "Cordinate_highlightedRectangleId_fkey";

-- DropForeignKey
ALTER TABLE "Highlight" DROP CONSTRAINT "Highlight_userId_fkey";

-- AlterTable
ALTER TABLE "Cordinate" ALTER COLUMN "highlightedRectangleId" DROP NOT NULL,
ALTER COLUMN "highlightedBoundingRectangleId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Highlight" DROP COLUMN "userId",
ALTER COLUMN "pageNumber" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Cordinate" ADD CONSTRAINT "Cordinate_highlightedRectangleId_fkey" FOREIGN KEY ("highlightedRectangleId") REFERENCES "Highlight"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cordinate" ADD CONSTRAINT "Cordinate_highlightedBoundingRectangleId_fkey" FOREIGN KEY ("highlightedBoundingRectangleId") REFERENCES "Highlight"("id") ON DELETE SET NULL ON UPDATE CASCADE;
