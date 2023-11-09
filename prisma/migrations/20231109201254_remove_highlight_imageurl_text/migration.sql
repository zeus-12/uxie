/*
  Warnings:

  - You are about to drop the column `imageUrl` on the `Highlight` table. All the data in the column will be lost.
  - You are about to drop the column `text` on the `Highlight` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Highlight" DROP COLUMN "imageUrl",
DROP COLUMN "text";
