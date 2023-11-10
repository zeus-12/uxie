/*
  Warnings:

  - Changed the type of `role` on the `Collaborator` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "CollaboratorRole" AS ENUM ('EDITOR', 'VIEWER');

-- AlterTable
ALTER TABLE "Collaborator" DROP COLUMN "role",
ADD COLUMN     "role" "CollaboratorRole" NOT NULL;

-- DropEnum
DROP TYPE "DocumentAccessRole";
