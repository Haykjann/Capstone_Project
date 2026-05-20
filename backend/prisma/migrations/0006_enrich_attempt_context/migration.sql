-- Add contextual foreign keys and timestamps to Attempt
ALTER TABLE "Attempt"
  ADD COLUMN "orgId" TEXT,
  ADD COLUMN "quizId" TEXT,
  ADD COLUMN "userId" TEXT,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill contextual fields from the related assignment
UPDATE "Attempt" a
SET "orgId" = ass."orgId",
    "quizId" = ass."quizId",
    "userId" = ass."userId",
    "createdAt" = COALESCE(a."startedAt", CURRENT_TIMESTAMP),
    "updatedAt" = COALESCE(a."submittedAt", a."startedAt", CURRENT_TIMESTAMP)
FROM "Assignment" ass
WHERE ass."id" = a."assignmentId";

ALTER TABLE "Attempt"
  ALTER COLUMN "orgId" SET NOT NULL,
  ALTER COLUMN "quizId" SET NOT NULL,
  ALTER COLUMN "userId" SET NOT NULL;

-- Add foreign keys to ensure attempts remain org/quiz/user scoped
ALTER TABLE "Attempt"
  ADD CONSTRAINT "Attempt_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Attempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Attempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
