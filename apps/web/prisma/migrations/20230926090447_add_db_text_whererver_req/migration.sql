/*
  Warnings:

  - You are about to drop the column `notes` on the `Document` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Document" DROP COLUMN "notes",
ADD COLUMN     "note" TEXT;
