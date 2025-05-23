/*
  Warnings:

  - You are about to drop the column `cert_id` on the `QuizQuestions` table. All the data in the column will be lost.
  - You are about to drop the column `topic` on the `QuizQuestions` table. All the data in the column will be lost.
  - Added the required column `certification_topic_id` to the `QuizQuestions` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "QuizQuestions" DROP CONSTRAINT "QuizQuestions_cert_id_fkey";

-- AlterTable
ALTER TABLE "QuizQuestions" DROP COLUMN "cert_id",
DROP COLUMN "topic",
ADD COLUMN     "certification_topic_id" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "CertificationTopic" (
    "topic_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "cert_id" INTEGER NOT NULL,

    CONSTRAINT "CertificationTopic_pkey" PRIMARY KEY ("topic_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CertificationTopic_cert_id_name_key" ON "CertificationTopic"("cert_id", "name");

-- CreateIndex
CREATE INDEX "QuizQuestions_certification_topic_id_idx" ON "QuizQuestions"("certification_topic_id");

-- AddForeignKey
ALTER TABLE "CertificationTopic" ADD CONSTRAINT "CertificationTopic_cert_id_fkey" FOREIGN KEY ("cert_id") REFERENCES "Certifications"("cert_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizQuestions" ADD CONSTRAINT "QuizQuestions_certification_topic_id_fkey" FOREIGN KEY ("certification_topic_id") REFERENCES "CertificationTopic"("topic_id") ON DELETE CASCADE ON UPDATE CASCADE;
