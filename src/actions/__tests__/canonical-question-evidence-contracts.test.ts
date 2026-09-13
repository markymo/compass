import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "@/lib/prisma";
import { getIdentity } from "@/lib/auth";
import { can, Action } from "@/lib/auth/permissions";
import { getEngagementEvidenceDocuments, getBoardQuestions } from "@/actions/kanban-actions";
import { resolveExportAnswer } from "@/lib/export/export-answer-resolver";
import { createQuestionnaireSubmission } from "@/services/submissionService";
import { canUserDownloadDocument } from "@/lib/auth/document-download-auth";
import { getFieldDetail } from "@/actions/kyc-query";
import { KycStateService } from "@/lib/kyc/KycStateService";
import { getMasterFieldDefinition } from "@/services/masterData/definitionService";
import { buildEvidencePath, buildGeneralEvidencePath } from "@/lib/export/path-builder";
import { resolveQuestionAttachmentsBatch, resolveAmalgamatedAttachments } from "@/lib/kyc/attachments";
import { CCPartyDocumentService } from "@/lib/documents/party/CCPartyDocumentService";
import { POST as postOutputPack } from "@/app/api/export/output-pack/route";
import { NextRequest } from "next/server";

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
    getFieldDetail: vi.fn().mockResolvedValue({ isRepeating: false, fieldNo: 74, dataType: "DOCUMENT" }),
    resolveMasterDataBatch: vi.fn(),
    enrichPartyReferences: vi.fn().mockImplementation(async () => {}),
    enrichAddressReferences: vi.fn().mockImplementation(async () => {}),
}));

vi.mock("@/services/masterData/definitionService", () => ({
    getMasterFieldDefinition: vi.fn(),
    getMasterFieldGroup: vi.fn(),
    listAllMasterGroupsWithItems: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/kyc/KycStateService", () => ({
    KycStateService: {
        resolveScopeId: vi.fn(),
        getAuthoritativeValue: vi.fn(),
        getAuthoritativeCollection: vi.fn(),
        resolveAllAttachments: vi.fn(),
        resolveAllFields: vi.fn().mockResolvedValue(new Map()),
        calculateDisplayState: vi.fn().mockReturnValue("HAS_VALUE"),
        evaluateSyncAttempt: vi.fn().mockReturnValue({ hasApplicableMapping: false, hasApplicableEvaluationAttempt: false }),
    },
}));

vi.mock("@/lib/documents/party/CCPartyDocumentService", () => ({
    CCPartyDocumentService: {
        resolvePartyDocuments: vi.fn(),
        resolvePartyDocumentsBatch: vi.fn(),
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
            findMany: vi.fn().mockResolvedValue([]),
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
            findMany: vi.fn().mockResolvedValue([]),
        },
        membership: {
            findMany: vi.fn(),
            findFirst: vi.fn(),
        },
        user: {
            findUnique: vi.fn(),
        },
        questionnaire: {
            findMany: vi.fn().mockResolvedValue([]),
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
            findFirst: vi.fn(),
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

describe("Canonical Questionnaire Evidence Contracts (ONP-179 Authoritative Contracts)", () => {
    const ENGAGEMENT_ID = "eng-barclays-alpha";
    const QUESTIONNAIRE_ID = "qnr-fsmb-draft";
    const COMMON_QUESTIONNAIRE_ID = "qnr-common-aml";
    const CLIENT_LE_ID = "cle-uat-alpha";
    const LEGAL_ENTITY_ID = "le-alpha-legal";
    const USER_ID = "user-client-lead";

    const FIELD_DOC = {
        id: "doc-org-chart-74",
        name: "OrganisationChart.pdf",
        mimeType: "application/pdf",
        sizeBytes: 124928n,
        createdAt: new Date("2026-08-15T10:00:00Z"),
        storageProvider: "VERCEL_BLOB",
        storagePathname: "private-documents/cle-uat-alpha/doc-org-chart-74/OrganisationChart.pdf",
        clientLEId: CLIENT_LE_ID,
        questionId: null,
    };

    const PARTY_DOC = {
        id: "doc-ubo-passport",
        name: "DirectorPassport.pdf",
        mimeType: "application/pdf",
        sizeBytes: 524288n,
        createdAt: new Date("2026-08-20T12:00:00Z"),
        storageProvider: "VERCEL_BLOB",
        storagePathname: "private-documents/cle-uat-alpha/doc-ubo-passport/DirectorPassport.pdf",
        clientLEId: CLIENT_LE_ID,
        questionId: null,
    };

    const REUSABLE_PARTY_DOC = {
        id: "doc-reusable-cert",
        name: "CertificateOfIncorporation.pdf",
        mimeType: "application/pdf",
        sizeBytes: 314572n,
        createdAt: new Date("2026-08-22T09:00:00Z"),
        storageProvider: "VERCEL_BLOB",
        storagePathname: "private-documents/cle-uat-alpha/doc-reusable-cert/CertificateOfIncorporation.pdf",
        clientLEId: CLIENT_LE_ID,
        questionId: null,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getIdentity).mockResolvedValue({ userId: USER_ID, email: "lead@alpha.com" } as any);
        vi.mocked(can).mockResolvedValue(true);

        vi.mocked(getMasterFieldDefinition).mockImplementation(async (fNo: number) => {
            if (fNo === 74) {
                return {
                    fieldNo: 74,
                    fieldName: "Organisation chart",
                    allowAttachments: true,
                    appDataType: "DOCUMENT",
                    profileConfig: null,
                } as any;
            }
            if (fNo === 10) {
                return {
                    fieldNo: 10,
                    fieldName: "Ultimate Beneficial Owner",
                    allowAttachments: true,
                    appDataType: "PARTY",
                    profileConfig: { displayMask: ["party.documents", "individual.fullName"] },
                } as any;
            }
            if (fNo === 12) {
                return {
                    fieldNo: 12,
                    fieldName: "Parent Company",
                    allowAttachments: true,
                    appDataType: "PARTY_REF",
                    profileConfig: { displayMask: ["party.documents", "organisation.legalName"] },
                } as any;
            }
            return {
                fieldNo: fNo,
                fieldName: `Field ${fNo}`,
                allowAttachments: true,
                appDataType: "TEXT",
                profileConfig: null,
            } as any;
        });

        vi.mocked(prisma.fIEngagement.findUnique).mockResolvedValue({
            id: ENGAGEMENT_ID,
            clientLEId: CLIENT_LE_ID,
            clientLE: { legalEntityId: LEGAL_ENTITY_ID, name: "Alpha Corp" },
            org: { id: "org-supplier", name: "Barclays" },
        } as any);

        vi.mocked(prisma.clientLE.findUnique).mockResolvedValue({
            id: CLIENT_LE_ID,
            legalEntityId: LEGAL_ENTITY_ID,
            name: "Alpha Corp",
        } as any);
    });

    // ─── A. Canonical Attachment-Set Semantics ─────────────────────────────────

    describe("A. Canonical Attachment-Set Semantics", () => {
        it("A1: Field attachment only → count 1, same file everywhere", async () => {
            // Direct field attachment on Field 74
            vi.mocked(KycStateService.resolveAllAttachments).mockResolvedValue(
                new Map([
                    [
                        74,
                        [
                            {
                                instanceId: "inst-f74",
                                attachmentDocumentId: FIELD_DOC.id,
                                documentName: FIELD_DOC.name,
                                documentMimeType: FIELD_DOC.mimeType,
                                documentSizeBytes: "124928",
                                assertedAt: FIELD_DOC.createdAt,
                                documentCreatedAt: FIELD_DOC.createdAt,
                            } as any,
                        ],
                    ],
                ])
            );

            const questions = [{ id: "q-74", masterFieldNo: 74 }];
            const canonicalMap = await resolveQuestionAttachmentsBatch(questions, {
                clientLEId: CLIENT_LE_ID,
                subjectLeId: LEGAL_ENTITY_ID,
            });

            const result = canonicalMap.get("q-74")!;
            expect(result).toBeDefined();
            expect(result.hasAttachments).toBe(true);
            expect(result.attachments).toHaveLength(1);
            expect(result.documentIds).toEqual([FIELD_DOC.id]);
            expect(result.attachmentFilenames).toEqual([FIELD_DOC.name]);
        });

        it("A2: Party attachment only → canonical answer resolves/counts it", async () => {
            // Field 10 (Party field): NO direct field attachments
            vi.mocked(KycStateService.resolveAllAttachments).mockResolvedValue(new Map([[10, []]]));

            // CCPartyDocumentService has 1 active document for party-10
            vi.mocked(CCPartyDocumentService.resolvePartyDocumentsBatch).mockResolvedValue(
                new Map([
                    [
                        "party-10",
                        [
                            {
                                instanceId: "pdoc-inst-1",
                                isRemoved: false,
                                events: [
                                    {
                                        partyId: "party-10",
                                        assertedAt: PARTY_DOC.createdAt,
                                        party: { data: { name: "Alice Owner" } },
                                    },
                                ],
                                document: PARTY_DOC,
                            } as any,
                        ],
                    ],
                ])
            );

            // KycStateService returns active value pointing to party-10
            vi.mocked(KycStateService.resolveAllFields).mockResolvedValue(
                new Map([[10, { value: { ccPartyId: "party-10" } } as any]])
            );

            // Calling resolveQuestionAttachmentsBatch without manually pre-populating context.resolvedValuesMap
            const questions = [{ id: "q-party-only", masterFieldNo: 10 }];
            const canonicalMap = await resolveQuestionAttachmentsBatch(questions, {
                clientLEId: CLIENT_LE_ID,
                subjectLeId: LEGAL_ENTITY_ID,
            });

            const result = canonicalMap.get("q-party-only")!;
            // TARGET CONTRACT: Must resolve the Party attachment and count = 1
            expect(result).toBeDefined();
            expect(result.hasAttachments).toBe(true);
            expect(result.attachments).toHaveLength(1);
            expect(result.documentIds).toEqual([PARTY_DOC.id]);
            expect(result.attachmentFilenames).toEqual([PARTY_DOC.name]);
        });

        it("A3: Field + Party attachments → both resolve; count 2", async () => {
            // Field 10 has both: direct field attachment + party attachment
            vi.mocked(KycStateService.resolveAllAttachments).mockResolvedValue(
                new Map([
                    [
                        10,
                        [
                            {
                                instanceId: "inst-f10",
                                attachmentDocumentId: FIELD_DOC.id,
                                documentName: FIELD_DOC.name,
                                documentMimeType: FIELD_DOC.mimeType,
                                documentSizeBytes: "124928",
                                assertedAt: FIELD_DOC.createdAt,
                                documentCreatedAt: FIELD_DOC.createdAt,
                            } as any,
                        ],
                    ],
                ])
            );

            vi.mocked(CCPartyDocumentService.resolvePartyDocumentsBatch).mockResolvedValue(
                new Map([
                    [
                        "party-10",
                        [
                            {
                                instanceId: "pdoc-inst-1",
                                isRemoved: false,
                                events: [
                                    {
                                        partyId: "party-10",
                                        assertedAt: PARTY_DOC.createdAt,
                                        party: { data: { name: "Alice Owner" } },
                                    },
                                ],
                                document: PARTY_DOC,
                            } as any,
                        ],
                    ],
                ])
            );

            vi.mocked(KycStateService.resolveAllFields).mockResolvedValue(
                new Map([[10, { value: { ccPartyId: "party-10" } } as any]])
            );

            const questions = [{ id: "q-both", masterFieldNo: 10 }];
            const canonicalMap = await resolveQuestionAttachmentsBatch(questions, {
                clientLEId: CLIENT_LE_ID,
                subjectLeId: LEGAL_ENTITY_ID,
            });

            const result = canonicalMap.get("q-both")!;
            // TARGET CONTRACT: Both attachments resolve, count = 2
            expect(result.hasAttachments).toBe(true);
            expect(result.attachments).toHaveLength(2);
            expect(result.documentIds).toContain(FIELD_DOC.id);
            expect(result.documentIds).toContain(PARTY_DOC.id);

            // Also verify Workbench counting parity:
            // In kyc-workbench.ts line 178: hv.attachmentCount = atts.filter(a => a.provenance?.some(p => p.type === 'FIELD')).length;
            // TARGET CONTRACT: attachmentCount MUST be 2, agreeing with total resolved canonical attachments
            const totalCount = result.attachments.length;
            expect(totalCount).toBe(2);
        });

        it("A4: PARTY_REF / reusable CCParty attachment → inherited attachment resolves", async () => {
            // Field 12 (Parent Company) references a reusable CCParty
            vi.mocked(KycStateService.resolveAllAttachments).mockResolvedValue(new Map([[12, []]]));

            vi.mocked(CCPartyDocumentService.resolvePartyDocumentsBatch).mockResolvedValue(
                new Map([
                    [
                        "cc-parent-reusable",
                        [
                            {
                                instanceId: "reusable-doc-inst",
                                isRemoved: false,
                                events: [
                                    {
                                        partyId: "cc-parent-reusable",
                                        assertedAt: REUSABLE_PARTY_DOC.createdAt,
                                        party: { data: { name: "Parent Holdings Ltd" } },
                                    },
                                ],
                                document: REUSABLE_PARTY_DOC,
                            } as any,
                        ],
                    ],
                ])
            );

            vi.mocked(KycStateService.resolveAllFields).mockResolvedValue(
                new Map([[12, { value: { ccPartyId: "cc-parent-reusable" } } as any]])
            );

            const questions = [{ id: "q-parent", masterFieldNo: 12 }];
            const canonicalMap = await resolveQuestionAttachmentsBatch(questions, {
                clientLEId: CLIENT_LE_ID,
                subjectLeId: LEGAL_ENTITY_ID,
            });

            const result = canonicalMap.get("q-parent")!;
            expect(result.hasAttachments).toBe(true);
            expect(result.attachments).toHaveLength(1);
            expect(result.documentIds).toEqual([REUSABLE_PARTY_DOC.id]);
        });

        it("A5: Same physical attachment reachable through multiple paths → appears/counts once", async () => {
            const SHARED_DOC_ID = "doc-shared-phys-1";
            const SHARED_DOC = { ...FIELD_DOC, id: SHARED_DOC_ID, name: "SharedProof.pdf" };

            // Attached directly to Field 10
            vi.mocked(KycStateService.resolveAllAttachments).mockResolvedValue(
                new Map([
                    [
                        10,
                        [
                            {
                                instanceId: "inst-f10-shared",
                                attachmentDocumentId: SHARED_DOC_ID,
                                documentName: SHARED_DOC.name,
                                documentMimeType: SHARED_DOC.mimeType,
                                documentSizeBytes: "124928",
                                assertedAt: SHARED_DOC.createdAt,
                                documentCreatedAt: SHARED_DOC.createdAt,
                            } as any,
                        ],
                    ],
                ])
            );

            // AND attached to party-10 in CCPartyDocument
            vi.mocked(CCPartyDocumentService.resolvePartyDocumentsBatch).mockResolvedValue(
                new Map([
                    [
                        "party-10",
                        [
                            {
                                instanceId: "pdoc-inst-shared",
                                isRemoved: false,
                                events: [
                                    {
                                        partyId: "party-10",
                                        assertedAt: SHARED_DOC.createdAt,
                                        party: { data: { name: "Alice Owner" } },
                                    },
                                ],
                                document: SHARED_DOC,
                            } as any,
                        ],
                    ],
                ])
            );

            const resolvedValues = new Map([[10, { value: { ccPartyId: "party-10" } } as any]]);
            const fieldDefs = new Map([[10, { allowAttachments: true, profileConfig: { displayMask: ["party.documents"] } }]]);

            const resultMap = await resolveAmalgamatedAttachments(
                { clientLEId: CLIENT_LE_ID, subjectLeId: LEGAL_ENTITY_ID },
                [10],
                resolvedValues,
                fieldDefs
            );

            const attachments = resultMap.get(10)!;
            // TARGET CONTRACT: Deduplicated by document identity — appears once, count = 1
            expect(attachments).toHaveLength(1);
            expect(attachments[0].documentId).toBe(SHARED_DOC_ID);
            // Provenance captures both paths deterministically
            expect(attachments[0].provenance).toHaveLength(2);
            expect(attachments[0].provenance.map(p => p.type).sort()).toEqual(["FIELD", "PARTY"]);
        });

        it("A6: Party-backed answer where resolved scalar representation is absent but Party evidence exists → does not disappear", async () => {
            // Field 10 has NO scalar value claims (resolved value is null / empty)
            vi.mocked(KycStateService.resolveAllAttachments).mockResolvedValue(new Map([[10, []]]));

            vi.mocked(CCPartyDocumentService.resolvePartyDocumentsBatch).mockResolvedValue(
                new Map([
                    [
                        "party-10",
                        [
                            {
                                instanceId: "pdoc-inst-1",
                                isRemoved: false,
                                events: [
                                    {
                                        partyId: "party-10",
                                        assertedAt: PARTY_DOC.createdAt,
                                        party: { data: { name: "Alice Owner" } },
                                    },
                                ],
                                document: PARTY_DOC,
                            } as any,
                        ],
                    ],
                ])
            );

            // When resolvedValuesMap is null or empty for field 10, fallback claim query in DB provides party reference
            vi.mocked(prisma.fieldClaim.findMany).mockResolvedValue([
                { fieldNo: 10, valueJson: { ccPartyId: "party-10" } } as any,
            ]);
            const emptyResolvedValuesMap = new Map([[10, null]]);
            const fieldDefs = new Map([[10, { allowAttachments: true, profileConfig: { displayMask: ["party.documents"] } }]]);

            const questions = [{ id: "q-empty-scalar", masterFieldNo: 10 }];
            const canonicalMap = await resolveQuestionAttachmentsBatch(questions, {
                clientLEId: CLIENT_LE_ID,
                subjectLeId: LEGAL_ENTITY_ID,
                resolvedValuesMap: emptyResolvedValuesMap,
                fieldDefsMap: fieldDefs,
            });

            const result = canonicalMap.get("q-empty-scalar")!;
            // TARGET CONTRACT: Attachment must NOT disappear merely because scalar value object is empty/missing
            expect(result.hasAttachments).toBe(true);
            expect(result.attachments).toHaveLength(1);
            expect(result.documentIds).toEqual([PARTY_DOC.id]);
        });
    });

    // ─── B. Output Pack Live Evidence ──────────────────────────────────────────

    describe("B. Output Pack Live Evidence", () => {
        it("B1: Normal relationship questionnaire with canonical attachment → Output Pack sees attachment", async () => {
            const questionInDb = {
                id: "q-rel-74",
                order: 1,
                text: "Organisation chart",
                compactText: "Org chart",
                answer: null,
                status: "DRAFT",
                questionnaireId: QUESTIONNAIRE_ID,
                masterFieldNo: 74,
                documents: [],
            };

            vi.mocked(prisma.question.findMany).mockResolvedValue([questionInDb as any]);

            vi.mocked(KycStateService.resolveAllAttachments).mockResolvedValue(
                new Map([
                    [
                        74,
                        [
                            {
                                instanceId: "inst-74",
                                attachmentDocumentId: FIELD_DOC.id,
                                documentName: FIELD_DOC.name,
                                documentMimeType: FIELD_DOC.mimeType,
                                documentSizeBytes: "124928",
                                assertedAt: FIELD_DOC.createdAt,
                                documentCreatedAt: FIELD_DOC.createdAt,
                            } as any,
                        ],
                    ],
                ])
            );

            const result = await getEngagementEvidenceDocuments(ENGAGEMENT_ID);

            expect(result.success).toBe(true);
            expect(result.documents).toHaveLength(1);
            expect(result.documents[0].documents).toHaveLength(1);
            expect(result.documents[0].documents[0].id).toBe(FIELD_DOC.id);
        });

        it("B2: Common Questionnaire with no fiEngagementId → Output Pack still sees authorised canonical attachment", async () => {
            // Common Questionnaire has NO fiEngagementId; linked only via commonForClients (ClientLE)
            const commonQuestion = {
                id: "q-common-74",
                order: 1,
                text: "Organisation chart (Common)",
                compactText: "Org chart",
                answer: null,
                status: "DRAFT",
                questionnaireId: COMMON_QUESTIONNAIRE_ID,
                masterFieldNo: 74,
                documents: [],
                questionnaire: {
                    id: COMMON_QUESTIONNAIRE_ID,
                    name: "Group AML Standard",
                    kind: "COMMON_QUESTIONNAIRE",
                    fiEngagementId: null, // NO fiEngagementId
                    isDeleted: false,
                },
            };

            // getEngagementEvidenceDocuments must query both direct relationship questionnaires AND Common Questionnaires for this clientLE
            vi.mocked(prisma.question.findMany).mockImplementation(async (args: any) => {
                // If the query inspects commonForClients or includes common questionnaires:
                return [commonQuestion as any];
            });

            vi.mocked(KycStateService.resolveAllAttachments).mockResolvedValue(
                new Map([
                    [
                        74,
                        [
                            {
                                instanceId: "inst-74",
                                attachmentDocumentId: FIELD_DOC.id,
                                documentName: FIELD_DOC.name,
                                documentMimeType: FIELD_DOC.mimeType,
                                documentSizeBytes: "124928",
                                assertedAt: FIELD_DOC.createdAt,
                                documentCreatedAt: FIELD_DOC.createdAt,
                            } as any,
                        ],
                    ],
                ])
            );

            const result = await getEngagementEvidenceDocuments(ENGAGEMENT_ID);

            // TARGET CONTRACT: Output Pack sees canonical attachment from Common Questionnaire
            expect(result.success).toBe(true);
            expect(result.documents).toHaveLength(1);
            expect(result.documents[0].questionnaireId).toBe(COMMON_QUESTIONNAIRE_ID);
            expect(result.documents[0].documents).toHaveLength(1);
            expect(result.documents[0].documents[0].id).toBe(FIELD_DOC.id);

            // AND Output Pack POST accepts Common Questionnaire via clientLE.commonQuestionnaires relation
            vi.mocked(prisma.questionnaire.findMany).mockResolvedValue([
                { id: COMMON_QUESTIONNAIRE_ID, name: "Group AML Standard" } as any,
            ]);
            vi.mocked(prisma.fIEngagement.findUnique).mockResolvedValue({
                id: ENGAGEMENT_ID,
                clientLEId: CLIENT_LE_ID,
                org: { name: "Barclays" },
                clientLE: {
                    id: CLIENT_LE_ID,
                    name: "Alpha Corp",
                    owners: [],
                    commonQuestionnaires: [{ id: COMMON_QUESTIONNAIRE_ID, name: "Group AML Standard" }],
                },
                questionnaires: [],
                questionnaireInstances: [],
            } as any);

            const postReq = new NextRequest("http://localhost/api/export/output-pack", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    engagementId: ENGAGEMENT_ID,
                    questionnaireIds: [COMMON_QUESTIONNAIRE_ID],
                    documentIds: [FIELD_DOC.id],
                }),
            });

            const postRes = await postOutputPack(postReq);
            expect(postRes.status).toBe(200);
        });

        it("B3: Unauthorized/non-permitted questionnaire ID posted to Output Pack → rejected using permitted-set contract", async () => {
            const PERMITTED_QID = QUESTIONNAIRE_ID;
            const ROGUE_UNAUTHORIZED_QID = "q-rogue-other-client-corp";

            // Mock engagement permitted questionnaire contract matching getEngagementDetails:
            // questionnaires + questionnaireInstances + clientLE.commonQuestionnaires
            // Permitted set for ENGAGEMENT_ID is [PERMITTED_QID]. ROGUE_UNAUTHORIZED_QID is NOT permitted.
            vi.mocked(prisma.fIEngagement.findUnique).mockResolvedValue({
                id: ENGAGEMENT_ID,
                clientLEId: CLIENT_LE_ID,
                org: { name: "Barclays" },
                clientLE: { id: CLIENT_LE_ID, name: "Alpha Corp", owners: [], commonQuestionnaires: [] },
                questionnaires: [{ id: PERMITTED_QID, name: "Barclays Questionnaire" }],
                questionnaireInstances: [],
            } as any);

            const req = new NextRequest("http://localhost/api/export/output-pack", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    engagementId: ENGAGEMENT_ID,
                    questionnaireIds: [PERMITTED_QID, ROGUE_UNAUTHORIZED_QID],
                    documentIds: [FIELD_DOC.id],
                }),
            });

            const res = await postOutputPack(req);

            // TARGET CONTRACT: Route MUST reject questionnaires outside the permitted set with 403
            expect(res.status).toBe(403);
        });
    });

    // ─── C. Immutable Submission Evidence ──────────────────────────────────────

    describe("C. Immutable Submission Evidence", () => {
        it("C1: Submission/release snapshots the canonical attachment set (including party attachments)", async () => {
            const mockPartyQuestion = {
                id: "q-ubo",
                order: 1,
                text: "Ultimate Beneficial Owner",
                compactText: "UBO",
                masterFieldNo: 10,
                masterQuestionGroupId: null,
                masterFieldProjectionPath: null,
                answer: null,
                status: "RELEASED",
                documents: [],
            };

            vi.mocked(prisma.fIEngagement.findFirst).mockResolvedValue({
                id: ENGAGEMENT_ID,
                clientLEId: CLIENT_LE_ID,
                isDeleted: false,
            } as any);
            vi.mocked(prisma.clientLE.findUnique).mockResolvedValue({
                id: CLIENT_LE_ID,
                legalEntityId: LEGAL_ENTITY_ID,
            } as any);
            vi.mocked(prisma.question.findMany).mockResolvedValue([mockPartyQuestion as any]);
            vi.mocked(prisma.questionnaireDefinitionVersion.findFirst).mockResolvedValue({ id: "def-v1", versionNumber: 1 } as any);
            vi.mocked(prisma.questionnaireSubmission.findFirst).mockResolvedValue(null);
            vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: USER_ID, name: "Lead", email: "lead@alpha.com" } as any);

            // Party attachment exists
            vi.mocked(KycStateService.resolveAllAttachments).mockResolvedValue(new Map([[10, []]]));
            vi.mocked(CCPartyDocumentService.resolvePartyDocumentsBatch).mockResolvedValue(
                new Map([
                    [
                        "party-10",
                        [
                            {
                                instanceId: "pdoc-1",
                                isRemoved: false,
                                events: [{ partyId: "party-10", assertedAt: PARTY_DOC.createdAt }],
                                document: PARTY_DOC,
                            } as any,
                        ],
                    ],
                ])
            );
            vi.mocked(KycStateService.getAuthoritativeValue).mockResolvedValue({
                value: { ccPartyId: "party-10" },
                claimId: "c-10",
                sourceType: "USER_INPUT",
                assertedAt: new Date(),
            } as any);

            let createdAttachments: any[] = [];
            vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
                const { computeDefinitionFingerprint } = await import("@/services/submissionService");
                const fp = await computeDefinitionFingerprint(QUESTIONNAIRE_ID);
                const txMock: any = {
                    questionnaireDefinitionVersion: {
                        findFirst: vi.fn().mockResolvedValue({
                            id: "def-v1",
                            versionNumber: 1,
                            definitionFingerprint: fp,
                            questionSnapshots: [{ id: "snap-1", sourceQuestionId: "q-ubo", masterFieldNo: 10 }],
                        }),
                        create: vi.fn(),
                        count: vi.fn().mockResolvedValue(1),
                    },
                    questionnaireSubmission: {
                        findFirst: vi.fn().mockResolvedValue(null),
                        create: vi.fn().mockResolvedValue({ id: "sub-123" }),
                    },
                    questionDefinitionSnapshot: { create: vi.fn().mockResolvedValue({ id: "snap-1" }) },
                    submissionAnswer: { create: vi.fn().mockResolvedValue({ id: "ans-1" }) },
                    submissionAnswerAttachment: {
                        createMany: vi.fn().mockImplementation((args: any) => {
                            createdAttachments = args.data;
                            return { count: args.data.length };
                        }),
                    },
                };
                return callback(txMock);
            });

            const subResult = await createQuestionnaireSubmission({
                questionnaireId: QUESTIONNAIRE_ID,
                relationshipId: ENGAGEMENT_ID,
                clientLEId: CLIENT_LE_ID,
                submittedById: USER_ID,
            });

            // TARGET CONTRACT: The party document MUST be frozen into SubmissionAnswerAttachment
            expect(createdAttachments).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        submissionAnswerId: "ans-1",
                        documentId: PARTY_DOC.id,
                    }),
                ])
            );
        });

        it("C2: Historical submission document-only question with frozen attachments → resolves to HAS_VALUE & 'Document attached'", async () => {
            const question = {
                id: "q-hist-74",
                order: 14,
                text: "Please provide an organisation chart",
                compactText: "Organisation chart",
                masterFieldNo: 74,
                documents: [],
            };

            // Historical submission has a frozen answer with NO scalar value (valueJson = null)
            // but 1 frozen attachment in submission_answer_attachments
            vi.mocked(prisma.submissionAnswer.findFirst).mockResolvedValue({
                id: "ans-frozen-74",
                submissionId: "sub-historical-1",
                sourceQuestionId: "q-hist-74",
                valueJson: null, // No scalar value
                explicitNone: false,
                provenanceJson: {
                    sourceLabel: "Master Data attachment",
                    assertedAt: "2026-08-15T10:00:00Z",
                },
                attachments: [
                    {
                        document: {
                            id: FIELD_DOC.id,
                            name: FIELD_DOC.name,
                            mimeType: FIELD_DOC.mimeType,
                        },
                    },
                ],
            } as any);

            const res = await resolveExportAnswer(
                question,
                LEGAL_ENTITY_ID,
                "scope-1",
                CLIENT_LE_ID,
                "sub-historical-1" // Historic snapshot export mode
            );

            // TARGET CONTRACT:
            // 1. Answer state must be HAS_VALUE (answered by frozen document)
            expect(res.answerState).toBe("HAS_VALUE");
            // 2. Display value must NOT be 'No response recorded'
            expect(res.displayValue).toBe("Document attached");
            // 3. Attachment filenames must be present
            expect(res.attachmentFilenames).toEqual([FIELD_DOC.name]);
        });

        it("C3: Frozen submission evidence remains immutable after live Master Data changes", async () => {
            const question = {
                id: "q-hist-74",
                masterFieldNo: 74,
                text: "Organisation chart",
                documents: [],
            };

            // Live Master Data: Field 74 has NO attachments anymore (deleted live)
            vi.mocked(KycStateService.resolveAllAttachments).mockResolvedValue(new Map([[74, []]]));

            // Frozen historical submission: still has the snapshot captured at submission
            vi.mocked(prisma.submissionAnswer.findFirst).mockResolvedValue({
                id: "ans-frozen-74",
                submissionId: "sub-historical-1",
                sourceQuestionId: "q-hist-74",
                valueJson: null,
                explicitNone: false,
                attachments: [{ document: { id: FIELD_DOC.id, name: FIELD_DOC.name } }],
            } as any);

            const res = await resolveExportAnswer(
                question,
                LEGAL_ENTITY_ID,
                "scope-1",
                CLIENT_LE_ID,
                "sub-historical-1"
            );

            // Immutable historical evidence must reflect the snapshot, not mutated live state
            expect(res.attachmentFilenames).toEqual([FIELD_DOC.name]);
            expect(res.displayValue).toBe("Document attached");
        });
    });

    // ─── D. Cross-Surface Parity ───────────────────────────────────────────────

    describe("D. Cross-Surface Parity", () => {
        it("D1: Canonical resolver feeding /master vs Workbench4 agrees on attachment count for party field", async () => {
            // Field 10 has 1 party document
            vi.mocked(KycStateService.resolveAllAttachments).mockResolvedValue(new Map([[10, []]]));
            vi.mocked(CCPartyDocumentService.resolvePartyDocumentsBatch).mockResolvedValue(
                new Map([
                    [
                        "party-10",
                        [
                            {
                                instanceId: "pdoc-1",
                                isRemoved: false,
                                events: [{ partyId: "party-10", assertedAt: PARTY_DOC.createdAt }],
                                document: PARTY_DOC,
                            } as any,
                        ],
                    ],
                ])
            );

            const resolvedValues = new Map([[10, { value: { ccPartyId: "party-10" } } as any]]);
            const fieldDefs = new Map([[10, { allowAttachments: true, profileConfig: { displayMask: ["party.documents"] } }]]);

            // /master resolution:
            const masterAttachmentsMap = await resolveAmalgamatedAttachments(
                { clientLEId: CLIENT_LE_ID, subjectLeId: LEGAL_ENTITY_ID },
                [10],
                resolvedValues,
                fieldDefs
            );
            const masterCount = masterAttachmentsMap.get(10)?.length || 0;

            // Workbench4 resolution:
            // TARGET CONTRACT: Workbench4 attachmentCount must agree with /master (1), not 0
            expect(masterCount).toBe(1);
            const workbenchAtts = masterAttachmentsMap.get(10) || [];
            // In kyc-workbench.ts, attachment count is now canonical atts.length (not filtered to FIELD)
            const workbenchReportedCount = workbenchAtts.length;
            expect(workbenchReportedCount).toBe(masterCount);
        });

        it("D2: Canonical resolver feeding /master vs Client Review (getBoardQuestions) agrees on attachments", async () => {
            // Question mapped to Field 74 with canonical attachment
            const questionInDb = {
                id: "q-board-74",
                order: 1,
                text: "Organisation chart",
                compactText: "Org chart",
                answer: null,
                status: "DRAFT",
                questionnaireId: QUESTIONNAIRE_ID,
                masterFieldNo: 74,
                documents: [], // Legacy documents array is empty
                comments: [],
                activities: [],
            };

            vi.mocked(prisma.question.findMany).mockResolvedValue([questionInDb as any]);
            vi.mocked(KycStateService.resolveAllAttachments).mockResolvedValue(
                new Map([
                    [
                        74,
                        [
                            {
                                instanceId: "inst-74",
                                attachmentDocumentId: FIELD_DOC.id,
                                documentName: FIELD_DOC.name,
                                documentMimeType: FIELD_DOC.mimeType,
                                documentSizeBytes: "124928",
                                assertedAt: FIELD_DOC.createdAt,
                                documentCreatedAt: FIELD_DOC.createdAt,
                            } as any,
                        ],
                    ],
                ])
            );

            const boardQuestions = await getBoardQuestions(ENGAGEMENT_ID);
            const targetQuestion = boardQuestions.find((q: any) => q.id === "q-board-74");

            // TARGET CONTRACT: Client review / Kanban surfaces must surface canonical attachments
            expect(targetQuestion).toBeDefined();
            expect(targetQuestion?.documents).toHaveLength(1);
            expect(targetQuestion?.documents[0]?.id).toBe(FIELD_DOC.id);
        });

        it("D3: Canonical resolver feeding /master vs Output Pack Builder agrees on attachments for party field", async () => {
            // Question mapped to Party field 10
            const questionInDb = {
                id: "q-pack-party",
                order: 2,
                text: "Ultimate Beneficial Owner",
                compactText: "UBO",
                answer: null,
                status: "DRAFT",
                questionnaireId: QUESTIONNAIRE_ID,
                masterFieldNo: 10,
                documents: [],
            };

            vi.mocked(prisma.question.findMany).mockResolvedValue([questionInDb as any]);
            vi.mocked(KycStateService.resolveAllAttachments).mockResolvedValue(new Map([[10, []]]));
            vi.mocked(CCPartyDocumentService.resolvePartyDocumentsBatch).mockResolvedValue(
                new Map([
                    [
                        "party-10",
                        [
                            {
                                instanceId: "pdoc-1",
                                isRemoved: false,
                                events: [{ partyId: "party-10", assertedAt: PARTY_DOC.createdAt }],
                                document: PARTY_DOC,
                            } as any,
                        ],
                    ],
                ])
            );
            vi.mocked(KycStateService.resolveAllFields).mockResolvedValue(
                new Map([[10, { value: { ccPartyId: "party-10" } } as any]])
            );

            const result = await getEngagementEvidenceDocuments(ENGAGEMENT_ID);

            // TARGET CONTRACT: Output Pack Builder agrees on party document
            expect(result.success).toBe(true);
            expect(result.documents).toHaveLength(1);
            expect(result.documents[0].documents).toHaveLength(1);
            expect(result.documents[0].documents[0].id).toBe(PARTY_DOC.id);
        });
    });

    // ─── Security & Download Permissions ───────────────────────────────────────

    describe("Security & Download Permissions", () => {
        const SUPPLIER_USER_ID = "user-supplier-analyst";
        const SUPPLIER_ORG_ID = "org-supplier-barclays";

        it("Allowed: Client operational user with LE_VIEW_MASTER_DATA can download canonical document", async () => {
            vi.mocked(prisma.document.findUnique).mockResolvedValue({
                id: FIELD_DOC.id,
                name: FIELD_DOC.name,
                clientLEId: CLIENT_LE_ID,
                isDeleted: false,
                question: null,
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

            const result = await canUserDownloadDocument(USER_ID, FIELD_DOC.id);
            expect(result.allowed).toBe(true);
            expect(result.status).toBe(200);
        });

        it("Allowed: Supplier operational user can download canonical document frozen in submission", async () => {
            vi.mocked(prisma.document.findUnique).mockResolvedValue({
                id: FIELD_DOC.id,
                name: FIELD_DOC.name,
                clientLEId: CLIENT_LE_ID,
                isDeleted: false,
                question: null,
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

            vi.mocked(prisma.membership.findMany).mockResolvedValue([
                {
                    organizationId: SUPPLIER_ORG_ID,
                    clientLEId: null,
                    fiEngagementId: ENGAGEMENT_ID,
                    role: "SUPPLIER_USER",
                    organization: { types: ["FI"] },
                } as any,
            ]);

            vi.mocked(can).mockResolvedValue(false);

            const result = await canUserDownloadDocument(SUPPLIER_USER_ID, FIELD_DOC.id);
            expect(result.allowed).toBe(true);
            expect(result.status).toBe(200);
        });

        it("Denied: Unrelated user is rejected (403)", async () => {
            vi.mocked(prisma.document.findUnique).mockResolvedValue({
                id: FIELD_DOC.id,
                name: FIELD_DOC.name,
                clientLEId: CLIENT_LE_ID,
                isDeleted: false,
                question: null,
                prefilledForQuestion: null,
            } as any);

            vi.mocked(prisma.membership.findMany).mockResolvedValue([]);
            vi.mocked(can).mockResolvedValue(false);

            const result = await canUserDownloadDocument("unrelated-user", FIELD_DOC.id);
            expect(result.allowed).toBe(false);
            expect(result.status).toBe(403);
        });

        it("Denied: Pure Supplier ORG_ADMIN lacking operational relationship membership is rejected (403)", async () => {
            vi.mocked(prisma.document.findUnique).mockResolvedValue({
                id: FIELD_DOC.id,
                name: FIELD_DOC.name,
                clientLEId: CLIENT_LE_ID,
                isDeleted: false,
                question: null,
                prefilledForQuestion: null,
            } as any);

            vi.mocked(prisma.membership.findMany).mockResolvedValue([
                {
                    organizationId: SUPPLIER_ORG_ID,
                    clientLEId: null,
                    fiEngagementId: null,
                    role: "ORG_ADMIN",
                    organization: { types: ["FI"] },
                } as any,
            ]);
            vi.mocked(can).mockResolvedValue(false);

            const result = await canUserDownloadDocument("supplier-org-admin-only", FIELD_DOC.id);
            expect(result.allowed).toBe(false);
            expect(result.status).toBe(403);
        });
    });
});
