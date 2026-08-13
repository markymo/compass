-- CreateTable: QuestionnaireDefinitionVersion
CREATE TABLE "questionnaire_definition_versions" (
    "id" TEXT NOT NULL,
    "questionnaireId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "definitionFingerprint" TEXT NOT NULL,
    "titleSnapshot" TEXT NOT NULL,
    "descriptionSnapshot" TEXT,
    "questionCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "questionnaire_definition_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: QuestionDefinitionSnapshot
CREATE TABLE "question_definition_snapshots" (
    "id" TEXT NOT NULL,
    "definitionVersionId" TEXT NOT NULL,
    "sourceQuestionId" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "compactText" TEXT,
    "order" INTEGER NOT NULL,
    "sourceSectionId" TEXT,
    "masterFieldNo" INTEGER,
    "masterQuestionGroupId" TEXT,
    "masterFieldProjectionPath" TEXT,
    "expectedDataType" TEXT NOT NULL DEFAULT 'TEXT',
    "allowAttachments" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "question_definition_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable: QuestionnaireSubmission
CREATE TABLE "questionnaire_submissions" (
    "id" TEXT NOT NULL,
    "questionnaireId" TEXT NOT NULL,
    "definitionVersionId" TEXT NOT NULL,
    "relationshipId" TEXT NOT NULL,
    "clientLEId" TEXT NOT NULL,
    "submissionNumber" INTEGER NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedById" TEXT NOT NULL,

    CONSTRAINT "questionnaire_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SubmissionAnswer
CREATE TABLE "submission_answers" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "questionSnapshotId" TEXT NOT NULL,
    "sourceQuestionId" TEXT NOT NULL,
    "masterFieldNo" INTEGER,
    "masterQuestionGroupId" TEXT,
    "questionTextSnapshot" TEXT NOT NULL,
    "valueJson" JSONB,
    "explicitNone" BOOLEAN NOT NULL DEFAULT false,
    "provenanceJson" JSONB,

    CONSTRAINT "submission_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SubmissionAnswerAttachment
CREATE TABLE "submission_answer_attachments" (
    "submissionAnswerId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,

    CONSTRAINT "submission_answer_attachments_pkey" PRIMARY KEY ("submissionAnswerId","documentId")
);

-- CreateIndexes
CREATE INDEX "questionnaire_definition_versions_questionnaireId_idx" ON "questionnaire_definition_versions"("questionnaireId");
CREATE UNIQUE INDEX "questionnaire_definition_versions_questionnaireId_versionNumber_key" ON "questionnaire_definition_versions"("questionnaireId", "versionNumber");

CREATE INDEX "question_definition_snapshots_definitionVersionId_idx" ON "question_definition_snapshots"("definitionVersionId");

CREATE INDEX "questionnaire_submissions_questionnaireId_relationshipId_idx" ON "questionnaire_submissions"("questionnaireId", "relationshipId");
CREATE INDEX "questionnaire_submissions_relationshipId_submittedAt_idx" ON "questionnaire_submissions"("relationshipId", "submittedAt");
CREATE INDEX "questionnaire_submissions_clientLEId_idx" ON "questionnaire_submissions"("clientLEId");
CREATE UNIQUE INDEX "questionnaire_submissions_definitionVersionId_relationshipId_submissionNumber_key" ON "questionnaire_submissions"("definitionVersionId", "relationshipId", "submissionNumber");

CREATE INDEX "submission_answers_submissionId_idx" ON "submission_answers"("submissionId");
CREATE INDEX "submission_answers_sourceQuestionId_idx" ON "submission_answers"("sourceQuestionId");

CREATE INDEX "submission_answer_attachments_documentId_idx" ON "submission_answer_attachments"("documentId");

-- AddForeignKeys
ALTER TABLE "questionnaire_definition_versions" ADD CONSTRAINT "questionnaire_definition_versions_questionnaireId_fkey" FOREIGN KEY ("questionnaireId") REFERENCES "Questionnaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "question_definition_snapshots" ADD CONSTRAINT "question_definition_snapshots_definitionVersionId_fkey" FOREIGN KEY ("definitionVersionId") REFERENCES "questionnaire_definition_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "questionnaire_submissions" ADD CONSTRAINT "questionnaire_submissions_questionnaireId_fkey" FOREIGN KEY ("questionnaireId") REFERENCES "Questionnaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "questionnaire_submissions" ADD CONSTRAINT "questionnaire_submissions_definitionVersionId_fkey" FOREIGN KEY ("definitionVersionId") REFERENCES "questionnaire_definition_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "questionnaire_submissions" ADD CONSTRAINT "questionnaire_submissions_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "FIEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "questionnaire_submissions" ADD CONSTRAINT "questionnaire_submissions_clientLEId_fkey" FOREIGN KEY ("clientLEId") REFERENCES "ClientLE"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "questionnaire_submissions" ADD CONSTRAINT "questionnaire_submissions_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "submission_answers" ADD CONSTRAINT "submission_answers_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "questionnaire_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "submission_answers" ADD CONSTRAINT "submission_answers_questionSnapshotId_fkey" FOREIGN KEY ("questionSnapshotId") REFERENCES "question_definition_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "submission_answer_attachments" ADD CONSTRAINT "submission_answer_attachments_submissionAnswerId_fkey" FOREIGN KEY ("submissionAnswerId") REFERENCES "submission_answers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "submission_answer_attachments" ADD CONSTRAINT "submission_answer_attachments_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
