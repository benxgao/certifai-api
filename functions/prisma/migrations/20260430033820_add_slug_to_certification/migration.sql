/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `Certification` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `slug` to the `Certification` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Certification" ADD COLUMN     "slug" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "AnswerOption_quiz_question_id_idx" ON "AnswerOption"("quiz_question_id");

-- CreateIndex
CREATE INDEX "AnswerOption_quiz_question_id_created_at_idx" ON "AnswerOption"("quiz_question_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "Certification_slug_key" ON "Certification"("slug");

-- CreateIndex
CREATE INDEX "Certification_firm_id_name_idx" ON "Certification"("firm_id", "name");

-- CreateIndex
CREATE INDEX "Certification_slug_idx" ON "Certification"("slug");

-- CreateIndex
CREATE INDEX "ExamAttempt_user_id_started_at_idx" ON "ExamAttempt"("user_id", "started_at");

-- CreateIndex
CREATE INDEX "ExamUserAnswer_exam_id_user_answer_id_idx" ON "ExamUserAnswer"("exam_id", "user_answer_id");

-- CreateIndex
CREATE INDEX "ExamUserAnswer_exam_id_quiz_question_id_idx" ON "ExamUserAnswer"("exam_id", "quiz_question_id");

-- CreateIndex
CREATE INDEX "User_user_id_updated_at_credit_tokens_energy_tokens_idx" ON "User"("user_id", "updated_at", "credit_tokens", "energy_tokens");

-- CreateIndex
CREATE INDEX "UserCertification_user_id_status_updated_at_idx" ON "UserCertification"("user_id", "status", "updated_at");

-- CreateIndex
CREATE INDEX "UserCertification_user_id_cert_id_updated_at_idx" ON "UserCertification"("user_id", "cert_id", "updated_at");
