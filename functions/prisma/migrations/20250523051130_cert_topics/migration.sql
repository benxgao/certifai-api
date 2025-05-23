/*
  Warnings:

  - You are about to drop the column `certification_topic_id` on the `QuizQuestions` table. All the data in the column will be lost.
  - You are about to drop the `CertificationTopic` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `cert_id` to the `QuizQuestions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `topic_id` to the `QuizQuestions` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "CertificationTopic" DROP CONSTRAINT "CertificationTopic_cert_id_fkey";

-- DropForeignKey
ALTER TABLE "QuizQuestions" DROP CONSTRAINT "QuizQuestions_certification_topic_id_fkey";

-- DropIndex
DROP INDEX "QuizQuestions_certification_topic_id_idx";

-- AlterTable
ALTER TABLE "QuizQuestions" DROP COLUMN "certification_topic_id",
ADD COLUMN     "cert_id" INTEGER NOT NULL,
ADD COLUMN     "topic_id" INTEGER NOT NULL;

-- DropTable
DROP TABLE "CertificationTopic";

-- CreateTable
CREATE TABLE "Topic" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertTopic" (
    "cert_id" INTEGER NOT NULL,
    "topic_id" INTEGER NOT NULL,

    CONSTRAINT "CertTopic_pkey" PRIMARY KEY ("cert_id","topic_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Topic_name_key" ON "Topic"("name");

-- CreateIndex
CREATE INDEX "QuizQuestions_cert_id_idx" ON "QuizQuestions"("cert_id");

-- CreateIndex
CREATE INDEX "QuizQuestions_topic_id_idx" ON "QuizQuestions"("topic_id");

-- AddForeignKey
ALTER TABLE "CertTopic" ADD CONSTRAINT "CertTopic_cert_id_fkey" FOREIGN KEY ("cert_id") REFERENCES "Certifications"("cert_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertTopic" ADD CONSTRAINT "CertTopic_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizQuestions" ADD CONSTRAINT "QuizQuestions_cert_id_fkey" FOREIGN KEY ("cert_id") REFERENCES "Certifications"("cert_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizQuestions" ADD CONSTRAINT "QuizQuestions_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
