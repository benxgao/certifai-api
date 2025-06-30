-- AlterTable
ALTER TABLE "ExamAttempt" ALTER COLUMN "token_cost" SET DEFAULT 60;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "credit_tokens" SET DEFAULT 300;

-- Update existing users to have 300 credit tokens if they have less than 300
UPDATE "User" SET "credit_tokens" = 300 WHERE "credit_tokens" < 300;
