-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('DRAFT', 'INTERNAL_REVIEW', 'SHARED', 'SUPPLIER_REVIEW', 'QUERY', 'CLIENT_SIGNED_OFF', 'SUPPLIER_SIGNED_OFF');

-- CreateEnum
CREATE TYPE "OrgType" AS ENUM ('CLIENT', 'FI', 'SYSTEM', 'LAW_FIRM');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EngagementStatus" AS ENUM ('PREPARATION', 'INVITED', 'CONNECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "QueryStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "AdminTodoStatus" AS ENUM ('BACKLOG', 'DRAFTING', 'IN_PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "EvidenceProvider" AS ENUM ('GLEIF', 'COMPANIES_HOUSE', 'USER_UPLOAD');

-- CreateEnum
CREATE TYPE "DocumentOwnerType" AS ENUM ('LEGAL_ENTITY', 'STAKEHOLDER', 'AUTHORIZED_TRADER');

-- CreateEnum
CREATE TYPE "StakeholderType" AS ENUM ('INDIVIDUAL', 'CORPORATE');

-- CreateEnum
CREATE TYPE "StakeholderRole" AS ENUM ('DIRECTOR', 'UBO', 'CONTROLLER');

-- CreateEnum
CREATE TYPE "ContactType" AS ENUM ('NOTICE', 'PROCESS_AGENT', 'OFFICE', 'PORTFOLIO_DATA', 'DISCREPANCY', 'DISPUTE');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "password" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "isDemoActor" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "types" "OrgType"[],
    "domain" TEXT,
    "logoUrl" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "clientLEId" TEXT,
    "role" TEXT NOT NULL,
    "permissions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterSchema" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "definition" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MasterSchema_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FISchema" (
    "id" TEXT NOT NULL,
    "fiOrgId" TEXT NOT NULL,
    "masterSchemaId" TEXT NOT NULL,
    "overlayDefinition" JSONB NOT NULL,

    CONSTRAINT "FISchema_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomFieldDefinition" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "dataType" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomFieldDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StandingDataSection" (
    "id" TEXT NOT NULL,
    "clientLEId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StandingDataSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientLE" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "jurisdiction" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lei" TEXT,
    "gleifData" JSONB,
    "gleifFetchedAt" TIMESTAMP(3),
    "nationalRegistryData" JSONB,
    "registryFetchedAt" TIMESTAMP(3),
    "billingDetails" JSONB,
    "customData" JSONB,

    CONSTRAINT "ClientLE_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientLEOwner" (
    "id" TEXT NOT NULL,
    "clientLEId" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientLEOwner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientLERecord" (
    "id" TEXT NOT NULL,
    "clientLEId" TEXT NOT NULL,
    "masterSchemaId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "status" "RecordStatus" NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientLERecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FIEngagement" (
    "id" TEXT NOT NULL,
    "fiOrgId" TEXT NOT NULL,
    "clientLEId" TEXT NOT NULL,
    "status" "EngagementStatus" NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "FIEngagement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EngagementActivity" (
    "id" TEXT NOT NULL,
    "fiEngagementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EngagementActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "clientLEId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "kbSize" INTEGER,
    "docType" TEXT,
    "metadata" JSONB,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Query" (
    "id" TEXT NOT NULL,
    "fiEngagementId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "status" "QueryStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Query_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Questionnaire" (
    "id" TEXT NOT NULL,
    "fiOrgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "fileName" TEXT,
    "fileType" TEXT,
    "fileContent" BYTEA,
    "mappings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "extractedContent" JSONB,
    "rawText" TEXT,
    "processingLogs" JSONB,
    "fiEngagementId" TEXT,
    "ownerOrgId" TEXT,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Questionnaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "questionnaireId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "compactText" TEXT,
    "answer" TEXT,
    "status" "QuestionStatus" NOT NULL DEFAULT 'DRAFT',
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "masterFieldNo" INTEGER,
    "masterQuestionGroupId" TEXT,
    "customFieldDefinitionId" TEXT,
    "sourceSectionId" TEXT,
    "assignedToUserId" TEXT,
    "assignedEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionActivity" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionnaireVersion" (
    "id" TEXT NOT NULL,
    "questionnaireId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "snapshotData" JSONB NOT NULL,
    "pdfContent" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionnaireVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "path" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminTodo" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "AdminTodoStatus" NOT NULL DEFAULT 'BACKLOG',
    "dueDate" TIMESTAMP(3),
    "assignedToUserId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AdminTodo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminTodoComment" (
    "id" TEXT NOT NULL,
    "adminTodoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminTodoComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "fiEngagementId" TEXT NOT NULL,
    "sentToEmail" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "acceptedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityId" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_entities" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_store" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "provider" "EvidenceProvider" NOT NULL,
    "payload" JSONB NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "retrievedAt" TIMESTAMP(3) NOT NULL,
    "capturedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_registry" (
    "id" TEXT NOT NULL,
    "legalEntityId" TEXT NOT NULL,
    "ownerType" "DocumentOwnerType" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "fieldNo" INTEGER NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedBy" TEXT NOT NULL,

    CONSTRAINT "document_registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_profiles" (
    "id" TEXT NOT NULL,
    "legalEntityId" TEXT,
    "leiValidationDate" TIMESTAMP(3),
    "leiCode" TEXT,
    "legalName" TEXT,
    "regAddressLine1" TEXT,
    "regAddressCity" TEXT,
    "regAddressRegion" TEXT,
    "regAddressCountry" TEXT,
    "regAddressPostcode" TEXT,
    "hqAddressLine1" TEXT,
    "hqAddressCity" TEXT,
    "hqAddressRegion" TEXT,
    "hqAddressCountry" TEXT,
    "hqAddressPostcode" TEXT,
    "entityStatus" TEXT,
    "entityCreationDate" TIMESTAMP(3),
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "clientLEId" TEXT,

    CONSTRAINT "identity_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_info_profiles" (
    "id" TEXT NOT NULL,
    "legalEntityId" TEXT NOT NULL,
    "gleifEntityCategory" TEXT,
    "entityLegalFormCode" TEXT,
    "countryOfFormation" TEXT,
    "countryCode" TEXT,
    "entityLegalFormLocalName" TEXT,
    "entityLegalFormTransliteratedName" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entity_info_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lei_registrations" (
    "id" TEXT NOT NULL,
    "legalEntityId" TEXT NOT NULL,
    "leiRegistrationDate" TIMESTAMP(3),
    "leiRegistrationUpdateDate" TIMESTAMP(3),
    "leiRegistrationStatus" TEXT,
    "leiRegistrationNextRenewal" TIMESTAMP(3),
    "leiIssuerLei" TEXT,
    "leiIssuer" TEXT,
    "leiCorroborationLevel" TEXT,
    "leiCorroborationSource" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lei_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relationship_profiles" (
    "id" TEXT NOT NULL,
    "legalEntityId" TEXT NOT NULL,
    "directParentId" TEXT,
    "directParent" TEXT,
    "directParentIdType" TEXT,
    "directParentRelationship" TEXT,
    "ultimateParentId" TEXT,
    "ultimateParent" TEXT,
    "ultimateParentIdType" TEXT,
    "ultimateParentRelationship" TEXT,
    "fundManagerId" TEXT,
    "fundManager" TEXT,
    "fundManagerIdType" TEXT,
    "fundManagerRelationship" TEXT,
    "fundManagerRelationshipStatus" TEXT,
    "umbrellaFundId" TEXT,
    "umbrellaFund" TEXT,
    "umbrellaFundIdType" TEXT,
    "umbrellaFundRelationship" TEXT,
    "umbrellaFundRelationshipStatus" TEXT,
    "leiDirectParentException" TEXT,
    "leiUltimateParentException" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "relationship_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "constitutional_profiles" (
    "id" TEXT NOT NULL,
    "legalEntityId" TEXT NOT NULL,
    "registrationAuthorityGleifId" TEXT,
    "registrationAuthority" TEXT,
    "registeredNumber" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "constitutional_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_profiles" (
    "id" TEXT NOT NULL,
    "legalEntityId" TEXT NOT NULL,
    "operatingCountries" JSONB,
    "highRiskCountries" JSONB,
    "highRiskSectors" JSONB,
    "ukSanctionsCheck" TEXT,
    "euSanctionsCheck" TEXT,
    "ofacSanctionsCheck" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_profiles" (
    "id" TEXT NOT NULL,
    "legalEntityId" TEXT NOT NULL,
    "fatcaStatus" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_profiles" (
    "id" TEXT NOT NULL,
    "legalEntityId" TEXT NOT NULL,
    "lastAccountsMadeUpTo" TIMESTAMP(3),
    "nextAccountingDate" TIMESTAMP(3),
    "nextAccountsDueDate" TIMESTAMP(3),
    "lastStatementDate" TIMESTAMP(3),
    "nextStatementDate" TIMESTAMP(3),
    "nextStatementDueDate" TIMESTAMP(3),
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "derivatives_profiles" (
    "id" TEXT NOT NULL,
    "legalEntityId" TEXT NOT NULL,
    "isdaMasterRegulatoryDisclosureLetterRef" TEXT,
    "isdaEmirClassificationLetterRef" TEXT,
    "isdaUsSelfdisclosureLetterRef" TEXT,
    "isdaReportingDelegationAgreementRef" TEXT,
    "isdaFiaEmirReportingDelegationRef" TEXT,
    "isda2013ReportingProtocolSideLetterRef" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "derivatives_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trading_profiles" (
    "id" TEXT NOT NULL,
    "legalEntityId" TEXT NOT NULL,
    "boardMinuteAuthorisingIndividualsRef" TEXT,
    "boardMinuteAuthorisingTransactionsRef" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trading_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_profiles" (
    "id" TEXT NOT NULL,
    "legalEntityId" TEXT NOT NULL,
    "processAgent" TEXT,
    "office" TEXT,
    "isMultibranchParty" BOOLEAN,
    "portfolioDataEmail" TEXT,
    "discrepancyNoticeEmail" TEXT,
    "disputeNoticeEmail" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_names" (
    "id" TEXT NOT NULL,
    "legalEntityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entity_names_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "industry_classifications" (
    "id" TEXT NOT NULL,
    "legalEntityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "scheme" TEXT NOT NULL,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "industry_classifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stakeholders" (
    "id" TEXT NOT NULL,
    "legalEntityId" TEXT NOT NULL,
    "stakeholderType" "StakeholderType" NOT NULL,
    "role" "StakeholderRole" NOT NULL,
    "fullName" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "placeOfBirth" TEXT,
    "nationalities" JSONB,
    "idDocumentId" TEXT,
    "legalName" TEXT,
    "leiCode" TEXT,
    "registrationAuthorityGleifId" TEXT,
    "registrationAuthority" TEXT,
    "registeredNumber" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stakeholders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_registrations" (
    "id" TEXT NOT NULL,
    "legalEntityId" TEXT NOT NULL,
    "taxId" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authorized_traders" (
    "id" TEXT NOT NULL,
    "legalEntityId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "mobile" TEXT,
    "products" JSONB,
    "authorityDocumentId" TEXT,
    "authorityAttestationText" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "authorized_traders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "legalEntityId" TEXT NOT NULL,
    "contactType" "ContactType" NOT NULL,
    "address" TEXT,
    "attention" TEXT,
    "email" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement_instructions" (
    "id" TEXT NOT NULL,
    "legalEntityId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "ibanSwift" TEXT NOT NULL,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settlement_instructions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_data_events" (
    "id" TEXT NOT NULL,
    "legalEntityId" TEXT NOT NULL,
    "fieldNo" INTEGER NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "source" TEXT NOT NULL,
    "evidenceId" TEXT,
    "actorId" TEXT,
    "reason" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "master_data_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_FIEngagementToQuestionnaire" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_FIEngagementToQuestionnaire_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_SharedDocuments" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_SharedDocuments_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_organizationId_clientLEId_key" ON "Membership"("userId", "organizationId", "clientLEId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomFieldDefinition_orgId_key_key" ON "CustomFieldDefinition"("orgId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "StandingDataSection_clientLEId_category_key" ON "StandingDataSection"("clientLEId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "ClientLE_lei_key" ON "ClientLE"("lei");

-- CreateIndex
CREATE INDEX "ClientLEOwner_clientLEId_idx" ON "ClientLEOwner"("clientLEId");

-- CreateIndex
CREATE INDEX "ClientLEOwner_partyId_idx" ON "ClientLEOwner"("partyId");

-- CreateIndex
CREATE UNIQUE INDEX "FIEngagement_fiOrgId_clientLEId_key" ON "FIEngagement"("fiOrgId", "clientLEId");

-- CreateIndex
CREATE INDEX "UsageLog_userId_idx" ON "UsageLog"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entityId_idx" ON "AuditLog"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "legal_entities_reference_key" ON "legal_entities"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "evidence_store_hash_key" ON "evidence_store"("hash");

-- CreateIndex
CREATE INDEX "evidence_store_hash_idx" ON "evidence_store"("hash");

-- CreateIndex
CREATE INDEX "evidence_store_provider_idx" ON "evidence_store"("provider");

-- CreateIndex
CREATE INDEX "document_registry_legalEntityId_idx" ON "document_registry"("legalEntityId");

-- CreateIndex
CREATE INDEX "document_registry_ownerType_ownerId_idx" ON "document_registry"("ownerType", "ownerId");

-- CreateIndex
CREATE INDEX "document_registry_fieldNo_idx" ON "document_registry"("fieldNo");

-- CreateIndex
CREATE UNIQUE INDEX "identity_profiles_legalEntityId_key" ON "identity_profiles"("legalEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "identity_profiles_clientLEId_key" ON "identity_profiles"("clientLEId");

-- CreateIndex
CREATE UNIQUE INDEX "entity_info_profiles_legalEntityId_key" ON "entity_info_profiles"("legalEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "lei_registrations_legalEntityId_key" ON "lei_registrations"("legalEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "relationship_profiles_legalEntityId_key" ON "relationship_profiles"("legalEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "constitutional_profiles_legalEntityId_key" ON "constitutional_profiles"("legalEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_profiles_legalEntityId_key" ON "compliance_profiles"("legalEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "tax_profiles_legalEntityId_key" ON "tax_profiles"("legalEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "financial_profiles_legalEntityId_key" ON "financial_profiles"("legalEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "derivatives_profiles_legalEntityId_key" ON "derivatives_profiles"("legalEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "trading_profiles_legalEntityId_key" ON "trading_profiles"("legalEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "contact_profiles_legalEntityId_key" ON "contact_profiles"("legalEntityId");

-- CreateIndex
CREATE INDEX "entity_names_legalEntityId_idx" ON "entity_names"("legalEntityId");

-- CreateIndex
CREATE INDEX "industry_classifications_legalEntityId_idx" ON "industry_classifications"("legalEntityId");

-- CreateIndex
CREATE INDEX "stakeholders_legalEntityId_idx" ON "stakeholders"("legalEntityId");

-- CreateIndex
CREATE INDEX "stakeholders_role_idx" ON "stakeholders"("role");

-- CreateIndex
CREATE INDEX "tax_registrations_legalEntityId_idx" ON "tax_registrations"("legalEntityId");

-- CreateIndex
CREATE INDEX "authorized_traders_legalEntityId_idx" ON "authorized_traders"("legalEntityId");

-- CreateIndex
CREATE INDEX "contacts_legalEntityId_idx" ON "contacts"("legalEntityId");

-- CreateIndex
CREATE INDEX "settlement_instructions_legalEntityId_idx" ON "settlement_instructions"("legalEntityId");

-- CreateIndex
CREATE INDEX "master_data_events_legalEntityId_fieldNo_timestamp_idx" ON "master_data_events"("legalEntityId", "fieldNo", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "master_data_events_evidenceId_idx" ON "master_data_events"("evidenceId");

-- CreateIndex
CREATE INDEX "_FIEngagementToQuestionnaire_B_index" ON "_FIEngagementToQuestionnaire"("B");

-- CreateIndex
CREATE INDEX "_SharedDocuments_B_index" ON "_SharedDocuments"("B");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_clientLEId_fkey" FOREIGN KEY ("clientLEId") REFERENCES "ClientLE"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FISchema" ADD CONSTRAINT "FISchema_fiOrgId_fkey" FOREIGN KEY ("fiOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FISchema" ADD CONSTRAINT "FISchema_masterSchemaId_fkey" FOREIGN KEY ("masterSchemaId") REFERENCES "MasterSchema"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomFieldDefinition" ADD CONSTRAINT "CustomFieldDefinition_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandingDataSection" ADD CONSTRAINT "StandingDataSection_clientLEId_fkey" FOREIGN KEY ("clientLEId") REFERENCES "ClientLE"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientLEOwner" ADD CONSTRAINT "ClientLEOwner_clientLEId_fkey" FOREIGN KEY ("clientLEId") REFERENCES "ClientLE"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientLEOwner" ADD CONSTRAINT "ClientLEOwner_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientLERecord" ADD CONSTRAINT "ClientLERecord_clientLEId_fkey" FOREIGN KEY ("clientLEId") REFERENCES "ClientLE"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientLERecord" ADD CONSTRAINT "ClientLERecord_masterSchemaId_fkey" FOREIGN KEY ("masterSchemaId") REFERENCES "MasterSchema"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FIEngagement" ADD CONSTRAINT "FIEngagement_clientLEId_fkey" FOREIGN KEY ("clientLEId") REFERENCES "ClientLE"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FIEngagement" ADD CONSTRAINT "FIEngagement_fiOrgId_fkey" FOREIGN KEY ("fiOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementActivity" ADD CONSTRAINT "EngagementActivity_fiEngagementId_fkey" FOREIGN KEY ("fiEngagementId") REFERENCES "FIEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementActivity" ADD CONSTRAINT "EngagementActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_clientLEId_fkey" FOREIGN KEY ("clientLEId") REFERENCES "ClientLE"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Query" ADD CONSTRAINT "Query_fiEngagementId_fkey" FOREIGN KEY ("fiEngagementId") REFERENCES "FIEngagement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Questionnaire" ADD CONSTRAINT "Questionnaire_fiOrgId_fkey" FOREIGN KEY ("fiOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Questionnaire" ADD CONSTRAINT "Questionnaire_fiEngagementId_fkey" FOREIGN KEY ("fiEngagementId") REFERENCES "FIEngagement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Questionnaire" ADD CONSTRAINT "Questionnaire_ownerOrgId_fkey" FOREIGN KEY ("ownerOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_customFieldDefinitionId_fkey" FOREIGN KEY ("customFieldDefinitionId") REFERENCES "CustomFieldDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_questionnaireId_fkey" FOREIGN KEY ("questionnaireId") REFERENCES "Questionnaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionActivity" ADD CONSTRAINT "QuestionActivity_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionActivity" ADD CONSTRAINT "QuestionActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionnaireVersion" ADD CONSTRAINT "QuestionnaireVersion_questionnaireId_fkey" FOREIGN KEY ("questionnaireId") REFERENCES "Questionnaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminTodo" ADD CONSTRAINT "AdminTodo_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminTodo" ADD CONSTRAINT "AdminTodo_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminTodoComment" ADD CONSTRAINT "AdminTodoComment_adminTodoId_fkey" FOREIGN KEY ("adminTodoId") REFERENCES "AdminTodo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminTodoComment" ADD CONSTRAINT "AdminTodoComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_fiEngagementId_fkey" FOREIGN KEY ("fiEngagementId") REFERENCES "FIEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_registry" ADD CONSTRAINT "document_registry_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_profiles" ADD CONSTRAINT "identity_profiles_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_profiles" ADD CONSTRAINT "identity_profiles_clientLEId_fkey" FOREIGN KEY ("clientLEId") REFERENCES "ClientLE"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_info_profiles" ADD CONSTRAINT "entity_info_profiles_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lei_registrations" ADD CONSTRAINT "lei_registrations_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationship_profiles" ADD CONSTRAINT "relationship_profiles_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "constitutional_profiles" ADD CONSTRAINT "constitutional_profiles_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_profiles" ADD CONSTRAINT "compliance_profiles_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_profiles" ADD CONSTRAINT "tax_profiles_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_profiles" ADD CONSTRAINT "financial_profiles_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "derivatives_profiles" ADD CONSTRAINT "derivatives_profiles_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trading_profiles" ADD CONSTRAINT "trading_profiles_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_profiles" ADD CONSTRAINT "contact_profiles_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_names" ADD CONSTRAINT "entity_names_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "industry_classifications" ADD CONSTRAINT "industry_classifications_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stakeholders" ADD CONSTRAINT "stakeholders_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_registrations" ADD CONSTRAINT "tax_registrations_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authorized_traders" ADD CONSTRAINT "authorized_traders_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_instructions" ADD CONSTRAINT "settlement_instructions_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data_events" ADD CONSTRAINT "master_data_events_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data_events" ADD CONSTRAINT "master_data_events_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence_store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FIEngagementToQuestionnaire" ADD CONSTRAINT "_FIEngagementToQuestionnaire_A_fkey" FOREIGN KEY ("A") REFERENCES "FIEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FIEngagementToQuestionnaire" ADD CONSTRAINT "_FIEngagementToQuestionnaire_B_fkey" FOREIGN KEY ("B") REFERENCES "Questionnaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SharedDocuments" ADD CONSTRAINT "_SharedDocuments_A_fkey" FOREIGN KEY ("A") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SharedDocuments" ADD CONSTRAINT "_SharedDocuments_B_fkey" FOREIGN KEY ("B") REFERENCES "FIEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
