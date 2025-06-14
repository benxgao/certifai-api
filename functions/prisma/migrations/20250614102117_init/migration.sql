-- CreateEnum
CREATE TYPE "CertificationStatus" AS ENUM ('PASSED', 'IN_PROGRESS', 'INTERESTED');

-- CreateEnum
CREATE TYPE "ExamStatus" AS ENUM ('PENDING_QUESTIONS', 'QUESTIONS_GENERATING', 'READY', 'IN_PROGRESS', 'COMPLETED', 'QUESTION_GENERATION_FAILED');

-- CreateTable
CREATE TABLE "Certification" (
    "cert_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "exam_guide_url" TEXT,
    "min_quiz_counts" INTEGER NOT NULL,
    "max_quiz_counts" INTEGER NOT NULL,
    "pass_score" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Certification_pkey" PRIMARY KEY ("cert_id")
);

-- CreateTable
CREATE TABLE "User" (
    "user_id" TEXT NOT NULL,
    "firebase_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "UserCertification" (
    "user_id" TEXT NOT NULL,
    "cert_id" INTEGER NOT NULL,
    "status" "CertificationStatus" NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCertification_pkey" PRIMARY KEY ("user_id","cert_id")
);

-- CreateTable
CREATE TABLE "QuizQuestion" (
    "quiz_question_id" TEXT NOT NULL,
    "cert_id" INTEGER NOT NULL,
    "topic_id" INTEGER,
    "difficulty" TEXT,
    "question_text" TEXT NOT NULL,
    "explanations" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_deprecated" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "QuizQuestion_pkey" PRIMARY KEY ("quiz_question_id")
);

-- CreateTable
CREATE TABLE "AnswerOption" (
    "option_id" TEXT NOT NULL,
    "quiz_question_id" TEXT NOT NULL,
    "option_text" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnswerOption_pkey" PRIMARY KEY ("option_id")
);

-- CreateTable
CREATE TABLE "ExamAttempt" (
    "exam_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "cert_id" INTEGER NOT NULL,
    "exam_status" "ExamStatus" NOT NULL DEFAULT 'PENDING_QUESTIONS',
    "total_questions" INTEGER,
    "score" DOUBLE PRECISION,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(3),

    CONSTRAINT "ExamAttempt_pkey" PRIMARY KEY ("exam_id")
);

-- CreateTable
CREATE TABLE "ExamUserAnswer" (
    "user_answer_id" TEXT NOT NULL,
    "exam_id" TEXT NOT NULL,
    "quiz_question_id" TEXT NOT NULL,
    "selected_option_id" TEXT,
    "is_correct" BOOLEAN,

    CONSTRAINT "ExamUserAnswer_pkey" PRIMARY KEY ("user_answer_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_firebase_user_id_key" ON "User"("firebase_user_id");

-- CreateIndex
CREATE INDEX "QuizQuestion_cert_id_idx" ON "QuizQuestion"("cert_id");

-- CreateIndex
CREATE INDEX "QuizQuestion_topic_id_idx" ON "QuizQuestion"("topic_id");

-- CreateIndex
CREATE UNIQUE INDEX "ExamUserAnswer_exam_id_quiz_question_id_key" ON "ExamUserAnswer"("exam_id", "quiz_question_id");

-- AddForeignKey
ALTER TABLE "UserCertification" ADD CONSTRAINT "UserCertification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCertification" ADD CONSTRAINT "UserCertification_cert_id_fkey" FOREIGN KEY ("cert_id") REFERENCES "Certification"("cert_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizQuestion" ADD CONSTRAINT "QuizQuestion_cert_id_fkey" FOREIGN KEY ("cert_id") REFERENCES "Certification"("cert_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerOption" ADD CONSTRAINT "AnswerOption_quiz_question_id_fkey" FOREIGN KEY ("quiz_question_id") REFERENCES "QuizQuestion"("quiz_question_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamAttempt" ADD CONSTRAINT "ExamAttempt_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamAttempt" ADD CONSTRAINT "ExamAttempt_cert_id_fkey" FOREIGN KEY ("cert_id") REFERENCES "Certification"("cert_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamUserAnswer" ADD CONSTRAINT "ExamUserAnswer_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "ExamAttempt"("exam_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamUserAnswer" ADD CONSTRAINT "ExamUserAnswer_quiz_question_id_fkey" FOREIGN KEY ("quiz_question_id") REFERENCES "QuizQuestion"("quiz_question_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamUserAnswer" ADD CONSTRAINT "ExamUserAnswer_selected_option_id_fkey" FOREIGN KEY ("selected_option_id") REFERENCES "AnswerOption"("option_id") ON DELETE SET NULL ON UPDATE CASCADE;
