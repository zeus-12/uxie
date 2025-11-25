/*
  Warnings:

  - Made the column `coverImageUrl` on table `Document` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Document" ALTER COLUMN "coverImageUrl" SET NOT NULL;
