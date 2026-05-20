-- Add QuizStatus enum
CREATE TYPE "QuizStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- Add status column to Quiz
ALTER TABLE "Quiz" ADD COLUMN "status" "QuizStatus" NOT NULL DEFAULT 'DRAFT';

-- Rename prompt to text (add new column then migrate data if exists)
ALTER TABLE "Question" ADD COLUMN "text" TEXT;
UPDATE "Question" SET "text" = "prompt";
ALTER TABLE "Question" ALTER COLUMN "text" SET NOT NULL;
ALTER TABLE "Question" DROP COLUMN "prompt";
