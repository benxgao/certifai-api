/*
  Warnings:

  - You are about to drop the column `quiz_question_id_list` on the `Exams` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Exams" DROP COLUMN "quiz_question_id_list";

-- CreateTable
CREATE TABLE "ExamQuestions" (
    "exam_question_id" SERIAL NOT NULL,
    "exam_id" INTEGER NOT NULL,
    "quiz_question_id" INTEGER NOT NULL,
    "user_answer" TEXT,
    "is_correct" BOOLEAN,

    CONSTRAINT "ExamQuestions_pkey" PRIMARY KEY ("exam_question_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExamQuestions_exam_id_quiz_question_id_key" ON "ExamQuestions"("exam_id", "quiz_question_id");

-- AddForeignKey
ALTER TABLE "ExamQuestions" ADD CONSTRAINT "ExamQuestions_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "Exams"("exam_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamQuestions" ADD CONSTRAINT "ExamQuestions_quiz_question_id_fkey" FOREIGN KEY ("quiz_question_id") REFERENCES "QuizQuestions"("quiz_question_id") ON DELETE RESTRICT ON UPDATE CASCADE;
