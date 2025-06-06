/*
  Warnings:

  - Added the required column `exam_id` to the `QuizQuestions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "QuizQuestions" ADD COLUMN     "exam_id" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "QuizQuestions_exam_id_idx" ON "QuizQuestions"("exam_id");

-- AddForeignKey
ALTER TABLE "QuizQuestions" ADD CONSTRAINT "QuizQuestions_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "Exams"("exam_id") ON DELETE CASCADE ON UPDATE CASCADE;
