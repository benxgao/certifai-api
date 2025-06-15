/*
  Warnings:

  - You are about to drop the column `topic_id` on the `QuizQuestion` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "QuizQuestion_topic_id_idx";

-- AlterTable
ALTER TABLE "QuizQuestion" DROP COLUMN "topic_id",
ADD COLUMN     "generated_from" TEXT;
