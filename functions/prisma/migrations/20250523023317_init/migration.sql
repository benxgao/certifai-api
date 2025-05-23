-- CreateEnum
CREATE TYPE "CertificationStatus" AS ENUM ('PASSED', 'IN_PROGRESS', 'INTERESTED');

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certifications" (
    "cert_id" SERIAL NOT NULL,
    "cert_category_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "exam_guide_url" TEXT,
    "min_quiz_counts" INTEGER NOT NULL,
    "max_quiz_counts" INTEGER NOT NULL,
    "pass_score" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Certifications_pkey" PRIMARY KEY ("cert_id")
);

-- CreateTable
CREATE TABLE "CertCategories" (
    "cert_category_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "CertCategories_pkey" PRIMARY KEY ("cert_category_id")
);

-- CreateTable
CREATE TABLE "Users" (
    "user_id" TEXT NOT NULL,
    "firebase_user_id" TEXT,

    CONSTRAINT "Users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "UserCertification" (
    "user_id" TEXT NOT NULL,
    "cert_id" INTEGER NOT NULL,
    "status" "CertificationStatus" NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCertification_pkey" PRIMARY KEY ("user_id","cert_id")
);

-- CreateTable
CREATE TABLE "QuizQuestions" (
    "quiz_question_id" TEXT NOT NULL,
    "cert_id" INTEGER NOT NULL,
    "difficulty" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "question_body" TEXT NOT NULL,
    "explanations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuizQuestions_pkey" PRIMARY KEY ("quiz_question_id")
);

-- CreateTable
CREATE TABLE "AnswerOption" (
    "option_id" TEXT NOT NULL,
    "quiz_question_id" TEXT NOT NULL,
    "option_text" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnswerOption_pkey" PRIMARY KEY ("option_id")
);

-- CreateTable
CREATE TABLE "Exams" (
    "exam_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "cert_id" INTEGER NOT NULL,
    "score" DOUBLE PRECISION,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(3),

    CONSTRAINT "Exams_pkey" PRIMARY KEY ("exam_id")
);

-- CreateTable
CREATE TABLE "ExamUserAnswers" (
    "exam_question_id" TEXT NOT NULL,
    "exam_id" TEXT NOT NULL,
    "quiz_question_id" TEXT NOT NULL,
    "selected_option_id" TEXT,
    "is_correct" BOOLEAN,

    CONSTRAINT "ExamUserAnswers_pkey" PRIMARY KEY ("exam_question_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Users_firebase_user_id_key" ON "Users"("firebase_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ExamUserAnswers_exam_id_quiz_question_id_key" ON "ExamUserAnswers"("exam_id", "quiz_question_id");

-- AddForeignKey
ALTER TABLE "Certifications" ADD CONSTRAINT "Certifications_cert_category_id_fkey" FOREIGN KEY ("cert_category_id") REFERENCES "CertCategories"("cert_category_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCertification" ADD CONSTRAINT "UserCertification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCertification" ADD CONSTRAINT "UserCertification_cert_id_fkey" FOREIGN KEY ("cert_id") REFERENCES "Certifications"("cert_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizQuestions" ADD CONSTRAINT "QuizQuestions_cert_id_fkey" FOREIGN KEY ("cert_id") REFERENCES "Certifications"("cert_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerOption" ADD CONSTRAINT "AnswerOption_quiz_question_id_fkey" FOREIGN KEY ("quiz_question_id") REFERENCES "QuizQuestions"("quiz_question_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exams" ADD CONSTRAINT "Exams_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exams" ADD CONSTRAINT "Exams_cert_id_fkey" FOREIGN KEY ("cert_id") REFERENCES "Certifications"("cert_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamUserAnswers" ADD CONSTRAINT "ExamUserAnswers_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "Exams"("exam_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamUserAnswers" ADD CONSTRAINT "ExamUserAnswers_quiz_question_id_fkey" FOREIGN KEY ("quiz_question_id") REFERENCES "QuizQuestions"("quiz_question_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamUserAnswers" ADD CONSTRAINT "ExamUserAnswers_selected_option_id_fkey" FOREIGN KEY ("selected_option_id") REFERENCES "AnswerOption"("option_id") ON DELETE SET NULL ON UPDATE CASCADE;
