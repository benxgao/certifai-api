/*
  Warnings:

  - The `difficulty` column on the `QuizQuestion` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "DifficultyLevel" AS ENUM ('EASY', 'ADVANCED', 'EXPERT');

-- AlterTable
ALTER TABLE "QuizQuestion" DROP COLUMN "difficulty",
ADD COLUMN     "difficulty" "DifficultyLevel";
