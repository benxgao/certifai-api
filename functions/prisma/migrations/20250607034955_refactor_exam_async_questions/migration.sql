/*
  Warnings:

  - You are about to drop the column `exam_id` on the `QuizQuestions` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ExamStatus" AS ENUM ('PENDING_QUESTIONS', 'QUESTIONS_GENERATING', 'READY', 'IN_PROGRESS', 'COMPLETED', 'QUESTION_GENERATION_FAILED');

-- DropForeignKey
ALTER TABLE "QuizQuestions" DROP CONSTRAINT "QuizQuestions_exam_id_fkey";

-- DropIndex
DROP INDEX "QuizQuestions_exam_id_idx";

-- AlterTable
ALTER TABLE "Exams" ADD COLUMN     "exam_status" "ExamStatus" NOT NULL DEFAULT 'PENDING_QUESTIONS',
ADD COLUMN     "total_questions" INTEGER;

-- AlterTable
ALTER TABLE "QuizQuestions" DROP COLUMN "exam_id",
ALTER COLUMN "difficulty" DROP NOT NULL,
ALTER COLUMN "topic_id" DROP NOT NULL;
