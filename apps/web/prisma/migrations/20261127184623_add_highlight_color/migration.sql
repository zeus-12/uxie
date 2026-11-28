-- CreateEnum
CREATE TYPE "HighlightColor" AS ENUM ('yellow', 'green', 'blue', 'red', 'orange');

-- AlterTable
ALTER TABLE "Highlight" ADD COLUMN     "color" "HighlightColor" NOT NULL DEFAULT 'yellow';
