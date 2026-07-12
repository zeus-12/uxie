/*
  Warnings:

  - Added the required column `contact_email` to the `Feedback` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Feedback" ADD COLUMN     "contact_email" TEXT NOT NULL;
