-- CreateTable
CREATE TABLE "Certifications" (
    "cert_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "exam_guide_url" TEXT,
    "min_quiz_counts" INTEGER NOT NULL,
    "max_quiz_counts" INTEGER NOT NULL,
    "cert_category_id" INTEGER NOT NULL,
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
    "user_id" SERIAL NOT NULL,

    CONSTRAINT "Users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "QuizQuestion" (
    "quiz_question_id" SERIAL NOT NULL,
    "cert_id" INTEGER NOT NULL,
    "difficulty" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "question_body" TEXT NOT NULL,
    "answer_options" TEXT NOT NULL,
    "correct_answers" TEXT NOT NULL,
    "explanations" TEXT,

    CONSTRAINT "QuizQuestion_pkey" PRIMARY KEY ("quiz_question_id")
);

-- CreateTable
CREATE TABLE "Exams" (
    "exam_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "cert_id" INTEGER NOT NULL,
    "quiz_question_id_list" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "submitted_at" TIMESTAMP(3),

    CONSTRAINT "Exams_pkey" PRIMARY KEY ("exam_id")
);

-- AddForeignKey
ALTER TABLE "Certifications" ADD CONSTRAINT "Certifications_cert_category_id_fkey" FOREIGN KEY ("cert_category_id") REFERENCES "CertCategories"("cert_category_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizQuestion" ADD CONSTRAINT "QuizQuestion_cert_id_fkey" FOREIGN KEY ("cert_id") REFERENCES "Certifications"("cert_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exams" ADD CONSTRAINT "Exams_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exams" ADD CONSTRAINT "Exams_cert_id_fkey" FOREIGN KEY ("cert_id") REFERENCES "Certifications"("cert_id") ON DELETE RESTRICT ON UPDATE CASCADE;
