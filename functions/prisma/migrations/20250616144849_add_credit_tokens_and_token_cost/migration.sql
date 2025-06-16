-- AlterTable
ALTER TABLE "ExamAttempt" ADD COLUMN     "token_cost" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "credit_tokens" INTEGER NOT NULL DEFAULT 0;
