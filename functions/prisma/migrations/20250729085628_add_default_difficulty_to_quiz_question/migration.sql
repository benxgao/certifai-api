-- Update all existing NULL difficulty values to EASY
UPDATE "QuizQuestion" SET "difficulty" = 'EASY' WHERE "difficulty" IS NULL;

-- Alter the column to add NOT NULL constraint and default value
ALTER TABLE "QuizQuestion" ALTER COLUMN "difficulty" SET NOT NULL;
ALTER TABLE "QuizQuestion" ALTER COLUMN "difficulty" SET DEFAULT 'EASY';
