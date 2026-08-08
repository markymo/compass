-- AlterTable: Add assignmentNote column to Question
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "assignmentNote" VARCHAR(1000);
