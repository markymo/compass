import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "@/lib/prisma";
import { getIdentity } from "@/lib/auth";
import { can, Action } from "@/lib/auth/permissions";
import { getEngagementEvidenceDocuments } from "@/actions/kanban-actions";
import { resolveExportAnswer } from "@/lib/export/export-answer-resolver";
import { createQuestionnaireSubmission } from "@/services/submissionService";
import { canUserDownloadDocument } from "@/lib/auth/document-download-auth";
import { getFieldDetail } from "@/actions/kyc-query";
import { KycStateService } from "@/lib/kyc/KycStateService";
import { getMasterFieldDefinition } from "@/services/masterData/definitionService";
import { buildEvidencePath, buildGeneralEvidencePath } from "@/lib/export/path-builder";
import { resolveQuestionAttachmentsBatch } from "@/lib/kyc/attachments";

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth", () => ({
    getIdentity: vi.fn(),
}));

vi.mock("@/lib/auth/permissions", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/auth/permissions")>();
    return {
        ...actual,
        can: vi.fn(),
    };
});

vi.mock("@/actions/kyc-query", () => ({
    getFieldDetail: vi.fn(),
    resolveMasterDataBatch: vi.fn(),
    enrichPartyReferences: vi.fn().mockImplementation(async () => {}),
    enrichAddressReferences: vi.fn().mockImplementation(async () => {}),
}));

vi.mock("@/services/masterData/definitionService", () => ({
    getMasterFieldDefinition: vi.fn(),
    getMasterFieldGroup: vi.fn(),
}));

vi.mock("@/lib/kyc/KycStateService", () => ({
    KycStateService: {
        resolveScopeId: vi.fn(),
        getAuthoritativeValue: vi.fn(),
        getAuthoritativeCollection: vi.fn(),
        resolveAllAttachments: vi.fn(),
        calculateDisplayState: vi.fn().mockReturnValue("HAS_VALUE"),
    },
}));

vi.mock("@/lib/prisma", () => {
    const mockPrisma: any = {
        question: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
        },
        fIEngagement: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            findMany: vi.fn(),
        },
        clientLE: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
        },
        fieldClaim: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
        },
        cCPartyDocument: {
            findMany: vi.fn(),
        },
        cCParty: {
            findMany: vi.fn(),
        },
        document: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
        },
        membership: {
            findMany: vi.fn(),
            findFirst: vi.fn(),
        },
        user: {
            findUnique: vi.fn(),
        },
        questionnaire: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
        },
        questionnaireDefinitionVersion: {
            findFirst: vi.fn(),
            create: vi.fn(),
        },
        questionnaireSubmission: {
            findFirst: vi.fn(),
            create: vi.fn(),
        },
        questionDefinitionSnapshot: {
            create: vi.fn(),
        },
        submissionAnswer: {
            create: vi.fn(),
        },
        submissionAnswerAttachment: {
            createMany: vi.fn(),
        },
        sourceFieldMapping: {
            findMany: vi.fn(),
        },
        $transaction: vi.fn(),
    };
    return { default: mockPrisma };
});

describe("Canonical Questionnaire Evidence Contracts (RED Phase 1)", () => {
    const ENGAGEMENT_ID = "eng-barclays-alpha";
    const QUESTIONNAIRE_ID = "qnr-fsmb-draft";
    const CLIENT_LE_ID = "cle-uat-alpha";
    const LEGAL_ENTITY_ID = "le-alpha-legal";
    const USER_ID = "user-client-lead";

    const CANONICAL_DOC = {
        id: "doc-org-chart-74",
        name: "OrganisationChart.pdf",
        mimeType: "application/pdf",
        sizeBytes: 124928n, // ~122 KB
        createdAt: new Date("2026-08-15T10:00:00Z"),
        storageProvider: "VERCEL_BLOB",
        storagePathname: "private-documents/cle-uat-alpha/doc-org-chart-74/OrganisationChart.pdf",
        clientLEId: CLIENT_LE_ID,
        questionId: null, // CRITICAL: null in canonical model
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getIdentity).mockResolvedValue({ userId: USER_ID, email: "lead@alpha.com" } as any);
        vi.mocked(getMasterFieldDefinition).mockResolvedValue({
            fieldNo: 74,
            fieldName: "Ownership structure chart",
            appDataType: "DOCUMENT_REF",
            isMultiValue: false,
            allowAttachments: true,
            profileConfig: null,
        } as any);
        vi.mocked(getFieldDetail).mockResolvedValue({
            fieldNo: 74,
            fieldName: "Ownership structure chart",
            dataType: "DOCUMENT_REF",
            isRepeating: false,
            displayState: "HAS_VALUE",
            profileConfig: null,
        } as any);
        vi.mocked(prisma.fIEngagement.findUnique).mockResolvedValue({
            id: ENGAGEMENT_ID,
            clientLEId: CLIENT_LE_ID,
            clientLE: { legalEntityId: LEGAL_ENTITY_ID },
        } as any);
        vi.mocked(prisma.fIEngagement.findFirst).mockResolvedValue({
            id: ENGAGEMENT_ID,
            clientLEId: CLIENT_LE_ID,
            clientLE: { legalEntityId: LEGAL_ENTITY_ID },
        } as any);
    });

    // ─── RED 1 & RED 2: Canonical Field 74 Attachment & Output Pack Builder ─

    describe("RED 1 & RED 2 — Output Pack Builder & Canonical Attachment Flow", () => {
        it("RED 1A: derives evidence for mapped question when Field 74 has attachment only (no scalar value)", async () => {
            // Setup question mapped to Field 74 with empty question.documents
            const questionInDb = {
                id: "q-org-chart",
                order: 14,
                text: "Please provide an organisation chart",
                compactText: "Organisation chart",
                answer: null,
                status: "DRAFT",
                questionnaireId: QUESTIONNAIRE_ID,
                masterFieldNo: 74,
                documents: [], // Legacy documents array is EMPTY
                questionnaire: {
                    id: QUESTIONNAIRE_ID,
                    name: "FSMB MASTER DRAFT",
                    isDeleted: false,
                },
            };

            vi.mocked(prisma.fIEngagement.findUnique).mockResolvedValue({
                id: ENGAGEMENT_ID,
                clientLEId: CLIENT_LE_ID,
                clientLE: { legalEntityId: LEGAL_ENTITY_ID },
            } as any);

            // Mock prisma question query for engagement
            // NOTE: In current dev, prisma.question.findMany filters on `documents: { some: { isDeleted: false } }`.
            // When question.documents = [], Prisma returns [] because it looks only at direct question.documents!
            vi.mocked(prisma.question.findMany).mockImplementation(async (args: any) => {
                if (args?.where?.documents?.some) {
                    // Current dev code execution path: question has no direct documents, so Prisma returns empty
                    return [];
                }
                return [questionInDb];
            });

            // Master Field 74 has canonical attachment in Master Data
            vi.mocked(KycStateService.resolveAllAttachments).mockResolvedValue(
                new Map([
                    [
                        74,
                        [
                            {
                                instanceId: "inst-org-chart-74",
                                attachmentDocumentId: CANONICAL_DOC.id,
                                documentName: CANONICAL_DOC.name,
                                documentMimeType: CANONICAL_DOC.mimeType,
                                documentSizeBytes: "124928",
                                assertedAt: CANONICAL_DOC.createdAt,
                                documentCreatedAt: CANONICAL_DOC.createdAt,
                            } as any,
                        ],
                    ],
                ])
            );

            // Execute the action that drives the Output Pack Builder evidence list
            const result = await getEngagementEvidenceDocuments(ENGAGEMENT_ID);

            // Must succeed and return the question with its canonical Master Data attachment
            expect(result.success).toBe(true);
            expect(result.documents).toHaveLength(1);
            expect(result.documents[0].id).toBe("q-org-chart");
            expect(result.documents[0].documents).toHaveLength(1);
            expect(result.documents[0].documents[0]).toMatchObject({
                id: CANONICAL_DOC.id,
                name: "OrganisationChart.pdf",
                fileType: "application/pdf",
                kbSize: 122,
            });
        });

        it("RED 1B: attachment result is identical when Field 74 has scalar value + attachment", async () => {
            // Variant B: Field 74 has both a scalar note/value and the same canonical attachment
            const questionInDb = {
                id: "q-org-chart",
                order: 14,
                text: "Please provide an organisation chart",
                compactText: "Organisation chart",
                answer: null,
                status: "DRAFT",
                questionnaireId: QUESTIONNAIRE_ID,
                masterFieldNo: 74,
                documents: [], // Still NO direct question.documents
            };

            vi.mocked(prisma.question.findMany).mockImplementation(async (args: any) => {
                if (args?.where?.documents?.some) {
                    return [];
                }
                return [questionInDb];
            });

            // Master Field 74 has canonical attachment in Master Data
            vi.mocked(KycStateService.resolveAllAttachments).mockResolvedValue(
                new Map([
                    [
                        74,
                        [
                            {
                                instanceId: "inst-org-chart-74",
                                attachmentDocumentId: CANONICAL_DOC.id,
                                documentName: CANONICAL_DOC.name,
                                documentMimeType: CANONICAL_DOC.mimeType,
                                documentSizeBytes: "124928",
                                assertedAt: CANONICAL_DOC.createdAt,
                                documentCreatedAt: CANONICAL_DOC.createdAt,
                            } as any,
                        ],
                    ],
                ])
            );

            const result = await getEngagementEvidenceDocuments(ENGAGEMENT_ID);

            // Must NOT drop or alter attachments due to presence/absence of scalar value
            expect(result.success).toBe(true);
            expect(result.documents).toHaveLength(1);
            expect(result.documents[0].documents).toHaveLength(1);
            expect(result.documents[0].documents[0].name).toBe("OrganisationChart.pdf");
        });

        it("RED 2: deduplicates canonical attachments if encountered via multiple claim paths", async () => {
            // If the same canonical Document.id is resolved via multiple claims/provenance, expose it once
            const questionInDb = {
                id: "q-org-chart",
                order: 14,
                text: "Please provide an organisation chart",
                compactText: "Organisation chart",
                answer: null,
                status: "DRAFT",
                questionnaireId: QUESTIONNAIRE_ID,
                masterFieldNo: 74,
                documents: [],
            };

            vi.mocked(prisma.question.findMany).mockImplementation(async (args: any) => {
                if (args?.where?.documents?.some) return [];
                return [questionInDb];
            });

            // Duplicate attachment entries for the same Document ID
            vi.mocked(KycStateService.resolveAllAttachments).mockResolvedValue(
                new Map([
                    [
                        74,
                        [
                            {
                                instanceId: "inst-org-chart-74-claim1",
                                attachmentDocumentId: CANONICAL_DOC.id,
                                documentName: CANONICAL_DOC.name,
                                documentMimeType: CANONICAL_DOC.mimeType,
                                documentSizeBytes: "124928",
                                assertedAt: CANONICAL_DOC.createdAt,
                                documentCreatedAt: CANONICAL_DOC.createdAt,
                            },
                            {
                                instanceId: "inst-org-chart-74-claim2",
                                attachmentDocumentId: CANONICAL_DOC.id,
                                documentName: CANONICAL_DOC.name,
                                documentMimeType: CANONICAL_DOC.mimeType,
                                documentSizeBytes: "124928",
                                assertedAt: CANONICAL_DOC.createdAt,
                                documentCreatedAt: CANONICAL_DOC.createdAt,
                            },
                        ] as any,
                    ],
                ])
            );

            const result = await getEngagementEvidenceDocuments(ENGAGEMENT_ID);

            expect(result.success).toBe(true);
            expect(result.documents).toHaveLength(1);
            // Exactly 1 attachment after canonical deduplication
            expect(result.documents[0].documents).toHaveLength(1);
        });
    });

    // ─── RED 3: Document-Only Export Answer ──────────────────────────────────

    describe("RED 3 — Document-Only Export Answer Contract", () => {
        it("returns answerState = HAS_VALUE, displayValue = 'Document attached', and attachmentFilenames", async () => {
            const question = {
                id: "q-org-chart",
                status: "DRAFT",
                masterFieldNo: 74,
                answer: null,
                documents: [],
            };

            // Master Field 74: Document-only field with NO scalar text value
            vi.mocked(KycStateService.getAuthoritativeValue).mockResolvedValue(null);
            vi.mocked(KycStateService.getAuthoritativeCollection).mockResolvedValue([]);

            // Canonical attachment exists for Field 74
            vi.mocked(KycStateService.resolveAllAttachments).mockResolvedValue(
                new Map([
                    [
                        74,
                        [
                            {
                                instanceId: "inst-org-chart-74",
                                attachmentDocumentId: CANONICAL_DOC.id,
                                documentName: "OrganisationChart.pdf",
                                documentMimeType: "application/pdf",
                                documentSizeBytes: "124928",
                                assertedAt: CANONICAL_DOC.createdAt,
                                documentCreatedAt: CANONICAL_DOC.createdAt,
                            } as any,
                        ],
                    ],
                ])
            );

            const res = await resolveExportAnswer(question, LEGAL_ENTITY_ID, "scope-1", CLIENT_LE_ID);

            // Canonical Document-Only Contract:
            // 1. Answer state must be HAS_VALUE (question is answered by document)
            expect(res.answerState).toBe("HAS_VALUE");
            // 2. Display value must NOT be 'No response recorded' or fake filename scalar
            expect(res.displayValue).toBe("Document attached");
            // 3. Attachments list contains the canonical filename
            expect(res.attachmentFilenames).toEqual(["OrganisationChart.pdf"]);
        });
    });

    // ─── RED 4: Submission Snapshot ─────────────────────────────────────────

    describe("RED 4 — Submission Snapshot Freezes Canonical Evidence", () => {
        it("freezes non-party canonical FieldClaim FILE_ATTACHMENT into SubmissionAnswerAttachment", async () => {
            const mockQuestion = {
                id: "q-org-chart",
                order: 1,
                text: "Please provide an organisation chart",
                compactText: "Organisation chart",
                masterFieldNo: 74,
                masterQuestionGroupId: null,
                masterFieldProjectionPath: null,
                answer: null,
                status: "RELEASED",
                documents: [], // Legacy documents array is EMPTY
            };

            vi.mocked(prisma.clientLE.findUnique).mockResolvedValue({
                id: CLIENT_LE_ID,
                legalEntityId: LEGAL_ENTITY_ID,
            } as any);

            vi.mocked(prisma.fIEngagement.findUnique).mockResolvedValue({
                id: ENGAGEMENT_ID,
                clientLEId: CLIENT_LE_ID,
            } as any);

            vi.mocked(prisma.user.findUnique).mockResolvedValue({
                id: USER_ID,
                name: "Lead User",
                email: "lead@alpha.com",
            } as any);

            vi.mocked(prisma.questionnaireDefinitionVersion.findFirst).mockResolvedValue({
                id: "def-v1",
                versionNumber: 1,
            } as any);

            vi.mocked(prisma.questionnaireSubmission.findFirst).mockResolvedValue(null);

            vi.mocked(prisma.question.findMany).mockResolvedValue([mockQuestion as any]);

            // Canonical FieldClaim FILE_ATTACHMENT exists for Field 74
            vi.mocked(prisma.fieldClaim.findMany).mockResolvedValue([
                {
                    id: "claim-att-74",
                    fieldNo: 74,
                    claimRole: "FILE_ATTACHMENT",
                    status: "VERIFIED",
                    attachmentDocumentId: CANONICAL_DOC.id,
                    attachmentDocument: CANONICAL_DOC,
                } as any,
            ]);

            vi.mocked(KycStateService.resolveAllAttachments).mockResolvedValue(
                new Map([
                    [
                        74,
                        [
                            {
                                instanceId: "inst-org-chart-74",
                                attachmentDocumentId: CANONICAL_DOC.id,
                                documentName: CANONICAL_DOC.name,
                                documentMimeType: CANONICAL_DOC.mimeType,
                                documentSizeBytes: "124928",
                                assertedAt: CANONICAL_DOC.createdAt,
                                documentCreatedAt: CANONICAL_DOC.createdAt,
                            } as any
                        ]
                    ]
                ])
            );

            // Track tx.submissionAnswerAttachment.createMany calls
            let capturedAttachments: any[] = [];
            vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
                const tx = {
                    questionnaire: {
                        findUnique: vi.fn().mockResolvedValue({ id: QUESTIONNAIRE_ID, name: "FSMB MASTER DRAFT" }),
                    },
                    question: {
                        findMany: vi.fn().mockResolvedValue([]),
                    },
                    questionnaireDefinitionVersion: {
                        findFirst: vi.fn().mockResolvedValue({
                            id: "def-v1",
                            versionNumber: 1,
                            definitionFingerprint: "dummy",
                            questionSnapshots: [{ id: "snap-1", sourceQuestionId: "q-org-chart" }]
                        }),
                        create: vi.fn().mockResolvedValue({
                            id: "def-v1",
                            versionNumber: 1,
                            questionSnapshots: [{ id: "snap-1", sourceQuestionId: "q-org-chart" }]
                        }),
                        count: vi.fn().mockResolvedValue(1),
                    },
                    questionnaireSubmission: {
                        findFirst: vi.fn().mockResolvedValue(null),
                        create: vi.fn().mockResolvedValue({ id: "sub-123" }),
                    },
                    questionDefinitionSnapshot: {
                        create: vi.fn().mockResolvedValue({ id: "snap-1" }),
                    },
                    submissionAnswer: {
                        create: vi.fn().mockResolvedValue({ id: "ans-1" }),
                    },
                    submissionAnswerAttachment: {
                        createMany: vi.fn().mockImplementation((args: any) => {
                            capturedAttachments = args.data;
                            return { count: args.data.length };
                        }),
                    },
                };
                return await callback(tx);
            });

            await createQuestionnaireSubmission({
                questionnaireId: QUESTIONNAIRE_ID,
                relationshipId: ENGAGEMENT_ID,
                clientLEId: CLIENT_LE_ID,
                submittedById: USER_ID,
            });

            // The immutable submission snapshot MUST capture the canonical Master Data attachment
            expect(capturedAttachments).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        submissionAnswerId: "ans-1",
                        documentId: CANONICAL_DOC.id,
                    }),
                ])
            );
        });
    });

    // ─── RED 5: Native Output Pack ZIP Lineage ──────────────────────────────

    describe("RED 5 — Native Output Pack ZIP Lineage Contract", () => {
        it("places canonical Field 74 document under questionnaire/question evidence path, not General Evidence", async () => {
            // In the Output Pack ZIP generator, when a document is selected for packaging:
            // Document has questionId = null (canonical Master Data document)
            const dbDoc = {
                id: CANONICAL_DOC.id,
                name: CANONICAL_DOC.name,
                storagePathname: CANONICAL_DOC.storagePathname,
                questionId: null, // Canonical: questionId is null!
                question: null,   // Direct prisma relation is null
            };

            vi.mocked(prisma.document.findMany).mockResolvedValue([dbDoc as any]);

            const expectedPath = buildEvidencePath("FSMB MASTER DRAFT", "Q14: Organisation chart", "OrganisationChart.pdf");

            // Setup questionnaire questions
            const questions = [
                {
                    id: "q-org-chart",
                    text: "Please provide an organisation chart",
                    compactText: "Q14: Organisation chart",
                    questionnaireId: QUESTIONNAIRE_ID,
                    masterFieldNo: 74,
                    questionnaire: { id: QUESTIONNAIRE_ID, name: "FSMB MASTER DRAFT" }
                }
            ];

            vi.mocked(KycStateService.resolveAllAttachments).mockResolvedValue(
                new Map([
                    [
                        74,
                        [
                            {
                                instanceId: "inst-org-chart-74",
                                attachmentDocumentId: CANONICAL_DOC.id,
                                documentName: CANONICAL_DOC.name,
                                documentMimeType: CANONICAL_DOC.mimeType,
                                documentSizeBytes: "124928",
                                assertedAt: CANONICAL_DOC.createdAt,
                                documentCreatedAt: CANONICAL_DOC.createdAt,
                            } as any
                        ]
                    ]
                ])
            );

            const canonicalMap = await resolveQuestionAttachmentsBatch(questions, {
                clientLEId: CLIENT_LE_ID,
                subjectLeId: LEGAL_ENTITY_ID
            });

            // Canonical lineage derives from Question → masterFieldNo → canonical attachment
            let generatedPath = buildGeneralEvidencePath(CANONICAL_DOC.name);
            for (const q of questions) {
                const atts = canonicalMap.get(q.id)?.attachments || [];
                if (atts.some(a => a.documentId === CANONICAL_DOC.id)) {
                    generatedPath = buildEvidencePath(q.questionnaire.name, q.compactText, CANONICAL_DOC.name);
                }
            }

            // Target Contract: Canonical lineage must place document under questionnaire evidence path
            expect(generatedPath).toBe(expectedPath);
        });

        it("validates that requested documentIds belong to the resolved evidence set for that engagement", async () => {
            const arbitraryUnlinkedDocId = "doc-unrelated-external-999";

            const questions = [
                {
                    id: "q-org-chart",
                    masterFieldNo: 74,
                }
            ];

            vi.mocked(KycStateService.resolveAllAttachments).mockResolvedValue(
                new Map([
                    [
                        74,
                        [
                            {
                                instanceId: "inst-org-chart-74",
                                attachmentDocumentId: CANONICAL_DOC.id,
                                documentName: CANONICAL_DOC.name,
                                documentMimeType: CANONICAL_DOC.mimeType,
                                documentSizeBytes: "124928",
                                assertedAt: CANONICAL_DOC.createdAt,
                                documentCreatedAt: CANONICAL_DOC.createdAt,
                            } as any
                        ]
                    ]
                ])
            );

            const canonicalMap = await resolveQuestionAttachmentsBatch(questions, {
                clientLEId: CLIENT_LE_ID,
                subjectLeId: LEGAL_ENTITY_ID
            });

            const validEvidenceIds = new Set<string>();
            for (const res of Array.from(canonicalMap.values())) {
                for (const att of res.attachments) {
                    validEvidenceIds.add(att.documentId);
                }
            }

            const requestedIds = [CANONICAL_DOC.id, arbitraryUnlinkedDocId];
            const allowedPackagedIds = requestedIds.filter(id => validEvidenceIds.has(id));

            // Target Contract: The packaged documents must ONLY include documents validated in this engagement's evidence
            expect(allowedPackagedIds).toEqual([CANONICAL_DOC.id]);
        });
    });

    // ─── RED 6: Document Download Authorization ─────────────────────────────

    describe("RED 6 — Document Download Authorization for Canonical Documents", () => {
        const SUPPLIER_USER_ID = "user-supplier-analyst";
        const SUPPLIER_ORG_ID = "org-supplier-barclays";

        it("Allowed: Client operational user with LE_VIEW_MASTER_DATA can download canonical document", async () => {
            vi.mocked(prisma.document.findUnique).mockResolvedValue({
                id: CANONICAL_DOC.id,
                name: CANONICAL_DOC.name,
                clientLEId: CLIENT_LE_ID,
                isDeleted: false,
                question: null, // questionId is null
                prefilledForQuestion: null,
            } as any);

            vi.mocked(prisma.membership.findMany).mockResolvedValue([
                {
                    organizationId: "org-client-alpha",
                    clientLEId: CLIENT_LE_ID,
                    role: "LE_ADMIN",
                    organization: { types: ["CLIENT"] },
                } as any,
            ]);

            vi.mocked(can).mockResolvedValue(true);

            const result = await canUserDownloadDocument(USER_ID, CANONICAL_DOC.id);
            expect(result.allowed).toBe(true);
            expect(result.status).toBe(200);
        });

        it("Allowed: Supplier operational user can download canonical document frozen in submission", async () => {
            // Target document: canonical Field 74 document frozen in submission
            vi.mocked(prisma.document.findUnique).mockResolvedValue({
                id: CANONICAL_DOC.id,
                name: CANONICAL_DOC.name,
                clientLEId: CLIENT_LE_ID,
                isDeleted: false,
                question: null, // Canonical: question is NULL
                prefilledForQuestion: null,
                submissionAttachments: [
                    {
                        submissionAnswer: {
                            submission: {
                                relationship: {
                                    id: ENGAGEMENT_ID,
                                    fiOrgId: SUPPLIER_ORG_ID,
                                    isDeleted: false,
                                },
                            },
                        },
                    },
                ],
            } as any);

            // Supplier user with operational membership on this relationship
            vi.mocked(prisma.membership.findMany).mockResolvedValue([
                {
                    organizationId: SUPPLIER_ORG_ID,
                    clientLEId: null,
                    fiEngagementId: ENGAGEMENT_ID,
                    role: "SUPPLIER_USER",
                    organization: { types: ["FI"] },
                } as any,
            ]);

            // User is not client LE member
            vi.mocked(can).mockResolvedValue(false);

            const result = await canUserDownloadDocument(SUPPLIER_USER_ID, CANONICAL_DOC.id);

            // Current dev: FAILS with 403 "Forbidden: Document not attached to a visible question"
            // because line 84 requires `document.question`!
            // Contract requirement: Supplier operational user must be allowed (200) for canonical evidence
            expect(result.allowed).toBe(true);
            expect(result.status).toBe(200);
        });

        it("Denied: Unrelated user is rejected (403)", async () => {
            vi.mocked(prisma.document.findUnique).mockResolvedValue({
                id: CANONICAL_DOC.id,
                name: CANONICAL_DOC.name,
                clientLEId: CLIENT_LE_ID,
                isDeleted: false,
                question: null,
                prefilledForQuestion: null,
            } as any);

            vi.mocked(prisma.membership.findMany).mockResolvedValue([]);
            vi.mocked(can).mockResolvedValue(false);

            const result = await canUserDownloadDocument("unrelated-user", CANONICAL_DOC.id);
            expect(result.allowed).toBe(false);
            expect(result.status).toBe(403);
        });

        it("Denied: Pure Supplier ORG_ADMIN lacking operational relationship membership is rejected (403)", async () => {
            vi.mocked(prisma.document.findUnique).mockResolvedValue({
                id: CANONICAL_DOC.id,
                name: CANONICAL_DOC.name,
                clientLEId: CLIENT_LE_ID,
                isDeleted: false,
                question: null,
                prefilledForQuestion: null,
            } as any);

            // User is ORG_ADMIN of Supplier Org, but has NO fiEngagementId membership on this relationship
            vi.mocked(prisma.membership.findMany).mockResolvedValue([
                {
                    organizationId: SUPPLIER_ORG_ID,
                    clientLEId: null,
                    fiEngagementId: null, // Structural admin only, no relationship access
                    role: "ORG_ADMIN",
                    organization: { types: ["FI"] },
                } as any,
            ]);
            vi.mocked(can).mockResolvedValue(false);

            const result = await canUserDownloadDocument("supplier-org-admin-only", CANONICAL_DOC.id);
            expect(result.allowed).toBe(false);
            expect(result.status).toBe(403);
        });
    });
});
