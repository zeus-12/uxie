/*
  Warnings:

  - You are about to drop the column `text` on the `Message` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Message" DROP COLUMN "text",
ADD COLUMN     "parts" JSON;
