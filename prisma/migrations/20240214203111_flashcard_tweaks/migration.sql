/*
  Warnings:

  - Made the column `userResponse` on table `FlashcardAttempt` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "FlashcardAttempt" ALTER COLUMN "userResponse" SET NOT NULL;
