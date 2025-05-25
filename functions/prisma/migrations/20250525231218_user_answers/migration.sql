/*
  Warnings:

  - The primary key for the `ExamUserAnswers` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `exam_question_id` on the `ExamUserAnswers` table. All the data in the column will be lost.
  - The required column `user_answer_id` was added to the `ExamUserAnswers` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE "ExamUserAnswers" DROP CONSTRAINT "ExamUserAnswers_pkey",
DROP COLUMN "exam_question_id",
ADD COLUMN     "user_answer_id" TEXT NOT NULL,
ADD CONSTRAINT "ExamUserAnswers_pkey" PRIMARY KEY ("user_answer_id");
