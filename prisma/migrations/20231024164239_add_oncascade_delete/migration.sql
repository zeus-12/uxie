-- DropForeignKey
ALTER TABLE "Cordinate" DROP CONSTRAINT "Cordinate_highlightedBoundingRectangleId_fkey";

-- DropForeignKey
ALTER TABLE "Cordinate" DROP CONSTRAINT "Cordinate_highlightedRectangleId_fkey";

-- DropForeignKey
ALTER TABLE "Highlight" DROP CONSTRAINT "Highlight_documentId_fkey";

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_documentId_fkey";

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Highlight" ADD CONSTRAINT "Highlight_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cordinate" ADD CONSTRAINT "Cordinate_highlightedRectangleId_fkey" FOREIGN KEY ("highlightedRectangleId") REFERENCES "Highlight"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cordinate" ADD CONSTRAINT "Cordinate_highlightedBoundingRectangleId_fkey" FOREIGN KEY ("highlightedBoundingRectangleId") REFERENCES "Highlight"("id") ON DELETE CASCADE ON UPDATE CASCADE;
