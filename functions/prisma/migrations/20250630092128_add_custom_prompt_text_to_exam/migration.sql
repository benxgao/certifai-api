-- AlterTable
ALTER TABLE "ExamAttempt" ADD COLUMN     "custom_prompt_text" TEXT;

-- CreateIndex
CREATE INDEX "QuizQuestion_generated_from_idx" ON "QuizQuestion"("generated_from");

-- AddForeignKey
ALTER TABLE "QuizQuestion" ADD CONSTRAINT "QuizQuestion_generated_from_fkey" FOREIGN KEY ("generated_from") REFERENCES "ExamAttempt"("exam_id") ON DELETE SET NULL ON UPDATE CASCADE;
