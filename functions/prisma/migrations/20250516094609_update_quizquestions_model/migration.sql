/*
  Warnings:

  - You are about to drop the `QuizQuestion` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "QuizQuestion" DROP CONSTRAINT "QuizQuestion_cert_id_fkey";

-- DropTable
DROP TABLE "QuizQuestion";

-- CreateTable
CREATE TABLE "QuizQuestions" (
    "quiz_question_id" SERIAL NOT NULL,
    "cert_id" INTEGER NOT NULL,
    "difficulty" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "question_body" TEXT NOT NULL,
    "answer_options" TEXT NOT NULL,
    "correct_answers" TEXT NOT NULL,
    "explanations" TEXT,

    CONSTRAINT "QuizQuestions_pkey" PRIMARY KEY ("quiz_question_id")
);

-- AddForeignKey
ALTER TABLE "QuizQuestions" ADD CONSTRAINT "QuizQuestions_cert_id_fkey" FOREIGN KEY ("cert_id") REFERENCES "Certifications"("cert_id") ON DELETE RESTRICT ON UPDATE CASCADE;
