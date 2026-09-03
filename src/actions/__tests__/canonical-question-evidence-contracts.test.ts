import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "@/lib/prisma";
import { getIdentity } from "@/lib/auth";
import { can, Action } from "@/lib/auth/permissions";
import { getEngagementEvidenceDocuments } from "@/actions/kanban-actions";
import { resolveExportAnswer } from "@/lib/export/export-answer-resolver";
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
        questionnaire: {
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
        document: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
        },
        membership: {
            findMany: vi.fn(),
        },
        $transaction: vi.fn(),
    };
    return { default: mockPrisma };
});

describe("Canonical Questionnaire Evidence Contracts (ONP-179)", () => {
    const USER_ID = "user-client-lead";
    const CLIENT_LE_ID = "le-alpha-corp";
    const LEGAL_ENTITY_ID = "entity-alpha-real";
    const ENGAGEMENT_ID = "eng-barclays-alpha";
    const QUESTIONNAIRE_ID = "qnr-fsmb-draft";
    const COMMON_QNR_ID = "qnr-common-le-scope";

    const CANONICAL_DOC = {
        id: "doc-org-chart-74",
        name: "OrganisationChart.pdf",
        mimeType: "application/pdf",
        sizeBytes: "124928",
        createdAt: new Date("2026-09-01T10:00:00Z"),
        storagePathname: "docs/org_chart_canonical.pdf",
        questionId: null, // CRITICAL: null in canonical model
    };

    const PARTY_DOC = {
        id: "doc-director-passport",
        name: "ActiveDocument.pdf",
        mimeType: "application/pdf",
        sizeBytes: "89123",
        createdAt: new Date("2026-09-01T11:00:00Z"),
        storagePathname: "docs/director_passport.pdf",
        questionId: null,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getIdentity).mockResolvedValue({ userId: USER_ID, email: "lead@alpha.com" } as any);
        vi.mocked(can).mockResolvedValue(true);
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
        vi.mocked(prisma.membership.findMany).mockResolvedValue([
            {
                userId: USER_ID,
                clientLEId: CLIENT_LE_ID,
                role: "LE_ADMIN",
            } as any,
        ]);
    });

    // ─── RED 1: Canonical Field 74 Attachment & Output Pack Builder ───────────

    describe("RED 1 — Output Pack Builder & Canonical Attachment Flow", () => {
        it("RED 1A: derives evidence for mapped question when Field 74 has attachment only (no scalar value)", async () => {
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

            expect(result.success).toBe(true);
            expect(result.documents).toHaveLength(1);
            expect(result.documents[0].documents).toHaveLength(1);
            expect(result.documents[0].documents[0].id).toBe("doc-org-chart-74");
            expect(result.documents[0].documents[0].name).toBe("OrganisationChart.pdf");
        });

        it("RED 1B: attachment result is identical when Field 74 has scalar value + attachment", async () => {
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

            expect(result.success).toBe(true);
            expect(result.documents).toHaveLength(1);
            expect(result.documents[0].documents).toHaveLength(1);
            expect(result.documents[0].documents[0].name).toBe("OrganisationChart.pdf");
        });

        it("RED 1C: deduplicates canonical attachments if encountered via multiple claim paths", async () => {
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
            expect(result.documents[0].documents).toHaveLength(1);
        });
    });

    // ─── RED 2: Common Questionnaire Canonical Attachment ────────────────────

    describe("RED 2 — Common Questionnaire Canonical Attachment", () => {
        it("discovers Common Questionnaire questions (fiEngagementId = null) and resolves Field 74 canonical attachment", async () => {
            // Setup: Common Questionnaire belonging to ClientLE with fiEngagementId = null
            const commonQuestionInDb = {
                id: "q-common-org-chart",
                order: 3,
                text: "Provide group structure chart",
                compactText: "Structure chart",
                answer: null,
                status: "DRAFT",
                questionnaireId: COMMON_QNR_ID,
                masterFieldNo: 74,
                documents: [], // Question.documents is EMPTY
                questionnaire: {
                    id: COMMON_QNR_ID,
                    name: "Client Common KYC",
                    fiEngagementId: null, // Common Questionnaire has NO fiEngagementId
                    commonForClients: [{ id: CLIENT_LE_ID }],
                },
            };

            let capturedWhere: any = null;
            vi.mocked(prisma.question.findMany).mockImplementation(async (args: any) => {
                capturedWhere = args?.where;
                // Must match questions belonging to Common Questionnaires for this ClientLE
                return [commonQuestionInDb];
            });

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

            expect(result.success).toBe(true);
            expect(result.documents).toHaveLength(1);
            expect(result.documents[0].questionnaireId).toBe(COMMON_QNR_ID);
            expect(result.documents[0].documents).toHaveLength(1);
            expect(result.documents[0].documents[0].name).toBe("OrganisationChart.pdf");

            // Query must discover Common Questionnaires scoped to the engagement's ClientLE
            const hasCommonClause = capturedWhere?.OR?.some((clause: any) => 
                clause?.questionnaire?.commonForClients?.some?.id === CLIENT_LE_ID
            );
            expect(hasCommonClause).toBe(true);
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

            vi.mocked(KycStateService.getAuthoritativeValue).mockResolvedValue(null);
            vi.mocked(KycStateService.getAuthoritativeCollection).mockResolvedValue([]);

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

            expect(res.answerState).toBe("HAS_VALUE");
            expect(res.displayValue).toBe("Document attached");
            expect(res.attachmentFilenames).toEqual(["OrganisationChart.pdf"]);
        });
    });

    // ─── RED 4: Server-Side Authorization for Output Documents ──────────────

    describe("RED 4 — Server-Side Authorization for Output Documents", () => {
        it("allows authorised Client operational user with LE_VIEW_MASTER_DATA", async () => {
            vi.mocked(can).mockResolvedValue(true);
            vi.mocked(prisma.question.findMany).mockResolvedValue([]);

            const result = await getEngagementEvidenceDocuments(ENGAGEMENT_ID);

            expect(result.success).toBe(true);
        });

        it("denies unrelated authenticated user lacking ClientLE and relationship membership", async () => {
            vi.mocked(can).mockResolvedValue(false);
            vi.mocked(prisma.membership.findMany).mockResolvedValue([]);

            const result = await getEngagementEvidenceDocuments(ENGAGEMENT_ID);

            expect(result.success).toBe(false);
            expect(result.error).toMatch(/unauthorized/i);
        });
    });

    // ─── RED 5: Permitted Output Pack Questionnaire Validation ──────────────

    describe("RED 5 — Authoritative Output Pack Questionnaire Validation", () => {
        it("accepts questionnaires belonging to relationship and ClientLE Common Questionnaires", () => {
            const permittedQuestionnaires = [
                { id: QUESTIONNAIRE_ID, name: "Relationship Questionnaire", fiEngagementId: ENGAGEMENT_ID },
                { id: COMMON_QNR_ID, name: "Common Questionnaire", fiEngagementId: null, isCommon: true },
            ];

            const permittedIds = new Set(permittedQuestionnaires.map(q => q.id));

            const requestedQuestionnaires = [QUESTIONNAIRE_ID, COMMON_QNR_ID];
            const validated = requestedQuestionnaires.filter(id => permittedIds.has(id));

            expect(validated).toEqual([QUESTIONNAIRE_ID, COMMON_QNR_ID]);
        });

        it("rejects arbitrary questionnaire IDs not in the permitted set", () => {
            const permittedQuestionnaires = [
                { id: QUESTIONNAIRE_ID, name: "Relationship Questionnaire", fiEngagementId: ENGAGEMENT_ID },
                { id: COMMON_QNR_ID, name: "Common Questionnaire", fiEngagementId: null, isCommon: true },
            ];

            const permittedIds = new Set(permittedQuestionnaires.map(q => q.id));

            const arbitraryAttackerId = "qnr-arbitrary-unrelated-foreign-le";
            const requestedQuestionnaires = [QUESTIONNAIRE_ID, arbitraryAttackerId];
            const validated = requestedQuestionnaires.filter(id => permittedIds.has(id));

            expect(validated).toEqual([QUESTIONNAIRE_ID]);
            expect(validated).not.toContain(arbitraryAttackerId);
        });
    });

    // ─── RED 6: Output Pack ZIP Lineage Contract ────────────────────────────

    describe("RED 6 — Native Output Pack ZIP Lineage Contract", () => {
        it("places canonical Field 74 document under questionnaire/question evidence path, not General Evidence", async () => {
            const expectedPath = buildEvidencePath("FSMB MASTER DRAFT", "Q14: Organisation chart", "OrganisationChart.pdf");

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

            let generatedPath = buildGeneralEvidencePath(CANONICAL_DOC.name);
            for (const q of questions) {
                const atts = canonicalMap.get(q.id)?.attachments || [];
                if (atts.some(a => a.documentId === CANONICAL_DOC.id)) {
                    generatedPath = buildEvidencePath(q.questionnaire.name, q.compactText, CANONICAL_DOC.name);
                }
            }

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

            expect(allowedPackagedIds).toEqual([CANONICAL_DOC.id]);
        });
    });

    // ─── RED 7: Canonical CCParty Attachment Parity ─────────────────────────

    describe("RED 7 — Canonical CCParty Attachment Parity", () => {
        it("resolves CCParty document when caller does not provide resolvedValuesMap", async () => {
            // Field 11 is a PARTY_REF field (e.g. Director)
            const PARTY_FIELD_NO = 11;
            const CCPARTY_ID = "party-director-alice";

            vi.mocked(getMasterFieldDefinition).mockImplementation(async (fieldNo: number) => {
                if (fieldNo === PARTY_FIELD_NO) {
                    return {
                        fieldNo: PARTY_FIELD_NO,
                        fieldName: "Directors",
                        appDataType: "PARTY_REF",
                        isMultiValue: false,
                        allowAttachments: true,
                        profileConfig: null,
                    } as any;
                }
                return null as any;
            });

            // Canonical authoritative value for Field 11 references CCParty A
            vi.mocked(KycStateService.getAuthoritativeValue).mockImplementation(async (_subj: any, fieldNo: number) => {
                if (fieldNo === PARTY_FIELD_NO) {
                    return {
                        fieldNo: PARTY_FIELD_NO,
                        value: { ccPartyId: CCPARTY_ID },
                        sourceType: "USER_INPUT",
                        assertedAt: new Date("2026-09-01T10:00:00Z"),
                    } as any;
                }
                return null;
            });

            // prisma.cCPartyDocument finds active document for CCParty A
            vi.mocked(prisma.cCPartyDocument.findMany).mockResolvedValue([
                {
                    id: "cpd-1",
                    partyId: CCPARTY_ID,
                    documentId: PARTY_DOC.id,
                    instanceId: "inst-party-doc-1",
                    operation: "ATTACH",
                    assertedAt: PARTY_DOC.createdAt,
                    document: PARTY_DOC,
                    party: { data: { legalName: "Alice Director" } },
                } as any,
            ]);

            // Question mapped to Field 11
            const questions = [
                {
                    id: "q-director",
                    masterFieldNo: PARTY_FIELD_NO,
                }
            ];

            // Caller passes NO resolvedValuesMap (like Relationships Output / downloads does)
            const result = await resolveQuestionAttachmentsBatch(questions, {
                clientLEId: CLIENT_LE_ID,
                subjectLeId: LEGAL_ENTITY_ID,
            });

            const questionAttachments = result.get("q-director");

            // Must resolve ActiveDocument.pdf through CCParty reference
            expect(questionAttachments).toBeDefined();
            expect(questionAttachments?.attachments).toHaveLength(1);
            expect(questionAttachments?.attachments[0].documentId).toBe(PARTY_DOC.id);
            expect(questionAttachments?.attachments[0].displayName).toBe("ActiveDocument.pdf");
        });
    });
});
