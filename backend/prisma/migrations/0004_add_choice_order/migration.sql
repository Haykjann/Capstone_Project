ALTER TABLE "Choice" ADD COLUMN "order" INTEGER;

-- populate order based on existing order by createdAt then id as fallback
WITH ordered_choices AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "questionId" ORDER BY "createdAt", "id") - 1 AS ord
  FROM "Choice"
)
UPDATE "Choice" c
SET "order" = o.ord
FROM ordered_choices o
WHERE c.id = o.id;

ALTER TABLE "Choice" ALTER COLUMN "order" SET NOT NULL;
ALTER TABLE "Choice" ADD CONSTRAINT "Choice_questionId_order_key" UNIQUE ("questionId", "order");
