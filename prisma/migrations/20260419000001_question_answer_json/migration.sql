-- AlterTable
ALTER TABLE "Question" ALTER COLUMN "answer" TYPE JSONB USING to_jsonb("answer");
