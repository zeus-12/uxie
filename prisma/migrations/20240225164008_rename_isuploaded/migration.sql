/*
  Warnings:

  - You are about to drop the column `is_uploaded` on the `Document` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Document" DROP COLUMN "is_uploaded",
ADD COLUMN     "isUploaded" BOOLEAN NOT NULL DEFAULT true;
