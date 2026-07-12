-- CreateEnum
CREATE TYPE "HighlightTypeEnum" AS ENUM ('TEXT', 'IMAGE');

-- AlterTable
ALTER TABLE "Highlight" ADD COLUMN     "type" "HighlightTypeEnum" NOT NULL DEFAULT 'TEXT';
