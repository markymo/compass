import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveExportAnswer } from '../export-answer-resolver';
import { KycStateService } from '@/lib/kyc/KycStateService';
import { getFieldDetail } from '@/actions/kyc-query';
import { getMasterFieldDefinition } from '@/services/masterData/definitionService';
import { CCPartyDocumentService } from '@/lib/documents/party/CCPartyDocumentService';
import prisma from '@/lib/prisma';

vi.mock('@/lib/kyc/KycStateService', () => ({
    KycStateService: {
        getAuthoritativeValue: vi.fn(),
        getAuthoritativeCollection: vi.fn(),
        resolveAllAttachments: vi.fn(),
    }
}));

vi.mock('@/actions/kyc-query', () => ({
    getFieldDetail: vi.fn(),
    resolveMasterDataBatch: vi.fn(),
    enrichPartyReferences: vi.fn().mockImplementation(async (arr) => {
        for (const item of arr) {
            const target = item?.value && item?.source ? item.value : item;
            if (target?.ccPartyId) {
                target._resolvedData = { ccParty: { data: { companyName: `Enviromena Limited` } } };
            }
        }
    }),
    enrichAddressReferences: vi.fn().mockImplementation(async () => {}),
}));

vi.mock('@/services/masterData/definitionService', () => ({
    getMasterFieldGroup: vi.fn(),
    getMasterFieldDefinition: vi.fn(),
}));

vi.mock('@/lib/documents/party/CCPartyDocumentService', () => ({
    CCPartyDocumentService: {
        resolvePartyDocuments: vi.fn(),
        resolvePartyDocumentsBatch: vi.fn(),
    }
}));

vi.mock('@/lib/prisma', () => ({
    default: {
        fieldClaim: {
            findUnique: vi.fn(),
            findMany: vi.fn().mockResolvedValue([])
        },
        sourceFieldMapping: {
            findMany: vi.fn().mockResolvedValue([])
        },
        cCPartyDocument: {
            findMany: vi.fn().mockResolvedValue([])
        },
        submissionAnswer: {
            findFirst: vi.fn().mockResolvedValue(null)
        }
    }
}));

describe('ONP-46 — Canonical Party Attachment Masking in Export Resolver', () => {
    const clientLEId = '56680ada-587f-4e20-b8fa-491b72157706';
    const subjectLeId = '40fa1059-a198-408f-8609-4a0d574d12f0';
    const ownerScopeId = '59be74c5-cfb9-46e3-8beb-dbf20c4eac6e';
    const partyId = '23ec91fa-fa0e-42bd-a918-737cc9cd85b7';
    const partyDocName = 'WORD_TEST_DOC.docx';
    const partyDocId = 'e96f9a69-b1f7-4a99-996d-4b7a1662d1c9';

    beforeEach(() => {
        vi.clearAllMocks();
        // Default: no direct field claims as attachments
        vi.mocked(KycStateService.resolveAllAttachments).mockResolvedValue(new Map());

        // Default: Party has active document attached
        vi.mocked(CCPartyDocumentService.resolvePartyDocumentsBatch).mockResolvedValue(new Map([
            [
                partyId,
                [
                    {
                        instanceId: 'pdoc-inst-1',
                        isRemoved: false,
                        documentId: partyDocId,
                        document: {
                            id: partyDocId,
                            name: partyDocName,
                            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                            sizeBytes: 15360,
                            createdAt: new Date('2026-08-19T09:23:42Z')
                        },
                        events: [{ partyId, assertedAt: new Date('2026-08-19T09:23:42Z') }]
                    } as any
                ]
            ]
        ]));
    });

    it('A. Negative Party-document export case: excludes party document when displayMask omits party.documents', async () => {
        const question = {
            id: 'q-f104',
            status: 'SHARED',
            masterFieldNo: 104,
            text: 'SSI callback contact(s)'
        };

        // F104 field definition with displayMask that EXCLUDES party.documents
        const f104Def = {
            fieldNo: 104,
            fieldName: 'SSI callback contact(s)',
            appDataType: 'PARTY',
            isMultiValue: true,
            allowAttachments: false,
            profileConfig: {
                displayMask: [
                    'contact.email',
                    'contact.phones',
                    'organisation.legalName',
                    'individual.fullName'
                ]
            }
        };

        vi.mocked(getMasterFieldDefinition).mockResolvedValue(f104Def as any);
        vi.mocked(getFieldDetail).mockResolvedValue({
            isRepeating: true,
            fieldNo: 104,
            dataType: 'PARTY',
            profileConfig: f104Def.profileConfig
        } as any);

        // F104 references partyId
        vi.mocked(KycStateService.getAuthoritativeCollection).mockResolvedValue([
            {
                value: { ccPartyId: partyId },
                sourceType: 'USER_INPUT',
                sourceReference: 'Added party',
                assertedAt: new Date('2026-08-19T10:47:30Z')
            } as any
        ]);

        const res = await resolveExportAnswer(question, subjectLeId, ownerScopeId, clientLEId);

        // CONTRACT: Since F104 displayMask does NOT include party.documents,
        // WORD_TEST_DOC.docx must NOT be present in attachmentFilenames.
        expect(res.attachmentFilenames).toBeUndefined();
    });

    it('B. Positive Party-document control: includes party document when displayMask includes party.documents', async () => {
        const question = {
            id: 'q-f274',
            status: 'SHARED',
            masterFieldNo: 274,
            text: 'Persons of significant control (other)'
        };

        // F274 field definition with displayMask that explicitly INCLUDES party.documents
        const f274Def = {
            fieldNo: 274,
            fieldName: 'Persons of significant control (other)',
            appDataType: 'PARTY',
            isMultiValue: true,
            allowAttachments: false,
            profileConfig: {
                displayMask: [
                    'organisation.legalName',
                    'individual.fullName',
                    'party.documents'
                ]
            }
        };

        vi.mocked(getMasterFieldDefinition).mockResolvedValue(f274Def as any);
        vi.mocked(getFieldDetail).mockResolvedValue({
            isRepeating: true,
            fieldNo: 274,
            dataType: 'PARTY',
            profileConfig: f274Def.profileConfig
        } as any);

        vi.mocked(KycStateService.getAuthoritativeCollection).mockResolvedValue([
            {
                value: { ccPartyId: partyId },
                sourceType: 'USER_INPUT',
                sourceReference: 'Added PSC party',
                assertedAt: new Date('2026-08-19T10:47:30Z')
            } as any
        ]);

        const res = await resolveExportAnswer(question, subjectLeId, ownerScopeId, clientLEId);

        // CONTRACT: Since displayMask includes party.documents, party attachment must be present
        expect(res.attachmentFilenames).toEqual([partyDocName]);
    });

    it('C. Direct historic field attachment: remains in export even when allowAttachments = false (ONP-49)', async () => {
        const question = {
            id: 'q-f39',
            status: 'SHARED',
            masterFieldNo: 39,
            text: 'Register of members location'
        };

        const f39Def = {
            fieldNo: 39,
            fieldName: 'Register of members location',
            appDataType: 'STRING',
            isMultiValue: false,
            allowAttachments: false // allowAttachments is FALSE
        };

        vi.mocked(getMasterFieldDefinition).mockResolvedValue(f39Def as any);
        vi.mocked(getFieldDetail).mockResolvedValue({
            isRepeating: false,
            fieldNo: 39,
            dataType: 'STRING'
        } as any);

        vi.mocked(KycStateService.getAuthoritativeValue).mockResolvedValue({
            value: 'Registered Office',
            sourceType: 'USER_INPUT',
            assertedAt: new Date('2026-08-01T10:00:00Z')
        } as any);

        // Historic direct FIELD attachment exists on Field 39
        vi.mocked(KycStateService.resolveAllAttachments).mockResolvedValue(new Map([
            [
                39,
                [
                    {
                        instanceId: 'field-att-inst-39',
                        attachmentDocumentId: 'doc-historic-39',
                        documentName: 'historic-register-extract.pdf',
                        assertedAt: new Date('2026-08-01T10:00:00Z'),
                        sourceType: 'USER_INPUT'
                    } as any
                ]
            ]
        ]));

        const res = await resolveExportAnswer(question, subjectLeId, ownerScopeId, clientLEId);

        // CONTRACT: Direct historic field attachment must remain exported despite allowAttachments = false
        expect(res.attachmentFilenames).toEqual(['historic-register-extract.pdf']);
    });

    it('D. Immutable submission attachment: exported from frozen submission snapshot regardless of live field mask', async () => {
        const question = {
            id: 'q-hist-f104',
            status: 'RELEASED',
            masterFieldNo: 104,
            text: 'SSI callback contact(s)'
        };

        // Live mask excludes party.documents
        const f104Def = {
            fieldNo: 104,
            fieldName: 'SSI callback contact(s)',
            appDataType: 'PARTY',
            isMultiValue: true,
            allowAttachments: false,
            profileConfig: {
                displayMask: ['contact.email']
            }
        };
        vi.mocked(getMasterFieldDefinition).mockResolvedValue(f104Def as any);

        // Historical submission answer has frozen submission attachment
        vi.mocked(prisma.submissionAnswer.findFirst).mockResolvedValue({
            id: 'sub-ans-frozen-1',
            submissionId: 'sub-hist-1',
            sourceQuestionId: 'q-hist-f104',
            valueJson: null,
            explicitNone: false,
            provenanceJson: { sourceLabel: 'Frozen Submission' },
            attachments: [
                {
                    document: {
                        id: 'doc-frozen-1',
                        name: 'frozen-submission-evidence.pdf'
                    }
                }
            ]
        } as any);

        const res = await resolveExportAnswer(
            question,
            subjectLeId,
            ownerScopeId,
            clientLEId,
            'sub-hist-1' // submissionId provided -> historical mode
        );

        // CONTRACT: Must export the frozen snapshot document, unaffected by live mask
        expect(res.attachmentFilenames).toEqual(['frozen-submission-evidence.pdf']);
        expect(res.displayValue).toBe('Document attached');
    });
});
