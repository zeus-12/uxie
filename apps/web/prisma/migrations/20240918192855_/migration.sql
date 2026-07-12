/*
  Warnings:

  - You are about to drop the column `isUserMessage` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `usedToolCalling` on the `Message` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Message" DROP COLUMN "isUserMessage",
DROP COLUMN "usedToolCalling";
