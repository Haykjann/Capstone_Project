-- Ensure a single answer per question per attempt
ALTER TABLE "AttemptAnswer"
ADD CONSTRAINT "AttemptAnswer_attemptId_questionId_key" UNIQUE ("attemptId", "questionId");
