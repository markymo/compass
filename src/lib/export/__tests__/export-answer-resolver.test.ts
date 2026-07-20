import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveExportAnswer } from '../export-answer-resolver';
import { KycStateService } from '@/lib/kyc/KycStateService';
import { getFieldDetail } from '@/actions/kyc-query';
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
            if (target?.ccPartyId) target._resolvedData = { ccParty: { data: { companyName: `Mocked Party ${target.ccPartyId}` } } };
        }
    }),
    enrichAddressReferences: vi.fn().mockImplementation(async (arr) => {
        for (const item of arr) {
            const target = item?.value && item?.source ? item.value : item;
            if (target?.ccAddressId) target._resolvedData = { ccAddress: { data: { addressLines: [`Mocked Address ${target.ccAddressId}`] } } };
        }
    }),
}));

vi.mock('@/services/masterData/definitionService', () => ({
    getMasterFieldGroup: vi.fn(),
    getMasterFieldDefinition: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
    default: {
        fieldClaim: {
            findUnique: vi.fn(),
            findMany: vi.fn()
        },
        sourceFieldMapping: {
            findMany: vi.fn()
        }
    }
}));

describe('Export Answer Resolver', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Provide a default mock for getFieldDetail to prevent undefined crashes
        vi.mocked(getFieldDetail).mockResolvedValue({
            dataType: 'string',
            profileConfig: {}
        } as any);
    });

    it('1. released mapped answer uses snapshotDate to remain frozen', async () => {
        const question = {
            status: 'RELEASED',
            releasedAt: new Date('2026-01-01T00:00:00Z'),
            masterFieldNo: 100,
            answer: null
        };
        
        vi.mocked(KycStateService.getAuthoritativeValue).mockResolvedValue({ value: "Frozen Value" } as any);
        
        const res = await resolveExportAnswer(question, "le-1", "scope-1", "entity-1");
        
        expect(KycStateService.getAuthoritativeValue).toHaveBeenCalledWith(
            { subjectLeId: "le-1", clientLEId: "entity-1" },
            100,
            "scope-1",
            question.releasedAt
        );
        expect(res.displayValue).toBe("Frozen Value");
    });

    describe('Provenance rules', () => {
        const fixedDate = new Date('2026-06-22T12:00:00Z');

        it('1. GLEIF value includes Source: GLEIF and timestamp', async () => {
            const question = { status: 'DRAFT', masterFieldNo: 100 };
            vi.mocked(KycStateService.getAuthoritativeValue).mockResolvedValue({
                value: "Value",
                sourceType: 'GLEIF',
                assertedAt: fixedDate
            } as any);

            const res = await resolveExportAnswer(question, "le-1", "scope-1", "entity-1");
            expect(res.sourceLabel).toBe("GLEIF");
            expect(res.sourceTimestamp).toBe(fixedDate.toISOString());
        });

        it('2. Companies House includes registry label and timestamp', async () => {
            const question = { status: 'DRAFT', masterFieldNo: 100 };
            vi.mocked(KycStateService.getAuthoritativeValue).mockResolvedValue({
                value: "Value",
                sourceType: 'REGISTRATION_AUTHORITY',
                sourceReference: 'COMPANIES_HOUSE',
                assertedAt: fixedDate
            } as any);

            const res = await resolveExportAnswer(question, "le-1", "scope-1", "entity-1");
            expect(res.sourceLabel).toBe("Companies House");
            expect(res.sourceTimestamp).toBe(fixedDate.toISOString());
        });

        it('3. USER_INPUT value includes user metadata', async () => {
            const question = { status: 'DRAFT', masterFieldNo: 100 };
            vi.mocked(KycStateService.getAuthoritativeValue).mockResolvedValue({
                value: "Value",
                sourceType: 'USER_INPUT',
                claimId: 'claim-123',
                assertedAt: fixedDate
            } as any);

            vi.mocked(prisma.fieldClaim.findUnique).mockResolvedValue({
                id: 'claim-123',
                verifiedBy: { name: 'Alice Smith' }
            } as any);

            const res = await resolveExportAnswer(question, "le-1", "scope-1", "entity-1");
            expect(res.sourceLabel).toBe("User input — Alice Smith");
            expect(res.sourceUserName).toBe("Alice Smith");
            expect(res.sourceTimestamp).toBe(fixedDate.toISOString());
        });

        it('4. released default shows releasing user and release timestamp', async () => {
            const question = { 
                status: 'RELEASED', 
                masterFieldNo: 100,
                releasedAt: fixedDate,
                releasedByUser: { name: "Bob Jones" }
            };
            vi.mocked(KycStateService.getAuthoritativeValue).mockResolvedValue(null);
            vi.mocked(getFieldDetail).mockResolvedValue({
                displayState: 'DEFAULT_RESPONSE',
                defaultResponse: "Fallback"
            } as any);

            const res = await resolveExportAnswer(question, "le-1", "scope-1", "entity-1");
            expect(res.sourceLabel).toBe("Released by Bob Jones");
            expect(res.sourceTimestamp).toBe(fixedDate);
            expect(res.sourceUserName).toBe("Bob Jones");
        });

        it('5. unreleased default shows Field default', async () => {
            const question = { status: 'DRAFT', masterFieldNo: 100 };
            vi.mocked(KycStateService.getAuthoritativeValue).mockResolvedValue(null);
            vi.mocked(getFieldDetail).mockResolvedValue({
                displayState: 'DEFAULT_RESPONSE',
                defaultResponse: "Fallback"
            } as any);

            const res = await resolveExportAnswer(question, "le-1", "scope-1", "entity-1");
            expect(res.sourceLabel).toBe("Field default");
            expect(res.sourceTimestamp).toBe(null);
        });

        it('6. source checked absence shows source/timestamp', async () => {
            const question = { status: 'DRAFT', masterFieldNo: 100 };
            vi.mocked(KycStateService.getAuthoritativeValue).mockResolvedValue(null);
            vi.mocked(getFieldDetail).mockResolvedValue({
                displayState: 'CHECKED_NO_DATA',
                current: { source: 'COMPANIES_HOUSE', timestamp: fixedDate }
            } as any);

            const res = await resolveExportAnswer(question, "le-1", "scope-1", "entity-1");
            expect(res.displayValue).toBe("None");
            expect(res.sourceLabel).toBe("Companies House");
            expect(res.sourceTimestamp).toBe(fixedDate);
        });

        it('7. released explicit None shows releasing user/timestamp', async () => {
            const question = { 
                status: 'RELEASED', 
                masterFieldNo: 100,
                releasedAt: fixedDate,
                releasedByUser: { name: "Charlie" }
            };
            vi.mocked(KycStateService.getAuthoritativeValue).mockResolvedValue({
                value: { explicitNone: true },
                sourceType: 'USER_INPUT',
                claimId: 'claim-123',
                assertedAt: fixedDate
            } as any);

            vi.mocked(prisma.fieldClaim.findUnique).mockResolvedValue({
                id: 'claim-123',
                verifiedBy: { name: 'Charlie' }
            } as any);

            const res = await resolveExportAnswer(question, "le-1", "scope-1", "entity-1");
            expect(res.displayValue).toBe("None");
            expect(res.sourceLabel).toBe("User input — Charlie");
            expect(res.sourceTimestamp).toBe(fixedDate.toISOString());
        });

        it('8. direct unmapped answer shows questionnaire/release provenance', async () => {
            const questionDraft = { answer: "Draft Answer", updatedAt: fixedDate };
            const resDraft = await resolveExportAnswer(questionDraft, "le-1", "scope-1", "entity-1");
            expect(resDraft.sourceLabel).toBe("Questionnaire answer");
            expect(resDraft.sourceTimestamp).toBe(fixedDate);

            const questionReleased = { 
                answer: "Released Answer", 
                status: 'RELEASED', 
                releasedAt: fixedDate,
                releasedByUser: { name: "Diana" }
            };
            const resReleased = await resolveExportAnswer(questionReleased, "le-1", "scope-1", "entity-1");
            expect(resReleased.sourceLabel).toBe("Released by Diana");
            expect(resReleased.sourceTimestamp).toBe(fixedDate);
        });

        it('9. no response recorded has no misleading source', async () => {
            const question = { status: 'DRAFT', masterFieldNo: 100 };
            vi.mocked(KycStateService.getAuthoritativeValue).mockResolvedValue(null);
            vi.mocked(getFieldDetail).mockResolvedValue({
                displayState: 'UNMAPPED_NO_RESPONSE'
            } as any);

            const res = await resolveExportAnswer(question, "le-1", "scope-1", "entity-1");
            expect(res.sourceLabel).toBeUndefined();
            expect(res.sourceTimestamp).toBeUndefined();
        });

        it('10. repeating field uses getAuthoritativeCollection and exports multiple resolved items', async () => {
            const question = { status: 'DRAFT', masterFieldNo: 63 };
            
            vi.mocked(getFieldDetail).mockResolvedValue({
                isRepeating: true,
                dataType: 'PARTY'
            } as any);
    
            const fixedDate = new Date('2026-06-22T12:00:00Z');
            
            vi.mocked(KycStateService.getAuthoritativeCollection).mockResolvedValue([
                { value: { ccPartyId: 'p1' }, sourceType: 'USER_INPUT', claimId: 'claim-1', assertedAt: fixedDate },
                { value: { ccPartyId: 'p2' }, sourceType: 'USER_INPUT', claimId: 'claim-2', assertedAt: fixedDate }
            ] as any);
    
            vi.mocked(prisma.fieldClaim.findUnique).mockResolvedValue({
                id: 'claim-1',
                verifiedBy: { name: 'Alice Smith' }
            } as any);
    
            const res = await resolveExportAnswer(question, "le-1", "scope-1", "entity-1");
            
            expect(KycStateService.getAuthoritativeCollection).toHaveBeenCalled();
            expect(KycStateService.getAuthoritativeValue).not.toHaveBeenCalled();
            expect(res.displayValue).toBe("• Mocked Party p1\n• Mocked Party p2");
            expect(res.sourceLabel).toBe("User input — Alice Smith"); // Pulled from primary claim (first item)
        });

        it('11. mapped address field stringified JSON is parsed before enrichment so it formats correctly', async () => {
            const question = { status: 'DRAFT', masterFieldNo: 15 };
            vi.mocked(getFieldDetail).mockResolvedValue({
                isRepeating: false,
                dataType: 'ADDRESS'
            } as any);

            const fixedDate = new Date('2026-06-22T12:00:00Z');
            
            // Simulating KycStateService returning the value as a stringified JSON (the bug condition)
            vi.mocked(KycStateService.getAuthoritativeValue).mockResolvedValue({
                value: JSON.stringify({ ccAddressId: 'addr-123' }),
                sourceType: 'COMPANIES_HOUSE',
                assertedAt: fixedDate
            } as any);

            const res = await resolveExportAnswer(question, "le-1", "scope-1", "entity-1");
            
            // Should be the enriched address, not ID:addr-123...
            expect(res.displayValue).toBe("Mocked Address addr-123");
        });

        it('12. grouped fields resolve properly preserving configuration and sequence', async () => {
            const question = { status: 'DRAFT', masterQuestionGroupId: 'group-1' };
            const { getMasterFieldGroup, getMasterFieldDefinition } = await import('@/services/masterData/definitionService');
            const { resolveMasterDataBatch } = await import('@/actions/kyc-query');
            
            vi.mocked(getMasterFieldGroup).mockResolvedValue({
                key: 'group-1',
                displayStyle: 'COMPACT',
                items: [
                    { fieldNo: 1, order: 1 },
                    { fieldNo: 2, order: 2 }
                ]
            } as any);

            vi.mocked(getMasterFieldDefinition).mockImplementation(async (fieldNo: number) => ({
                fieldNo, fieldName: `Field ${fieldNo}`, appDataType: 'STRING', isMultiValue: false, profileConfig: null
            } as any));

            vi.mocked(resolveMasterDataBatch).mockResolvedValue({
                [question.id]: {
                    1: { value: "Value A", source: "USER_INPUT", isSynced: true },
                    2: { value: "Value B", source: "USER_INPUT", isSynced: true }
                }
            } as any);

            vi.mocked(prisma.fieldClaim.findMany).mockResolvedValue([]);
            vi.mocked(KycStateService.resolveAllAttachments).mockResolvedValue(new Map());

            const res = await resolveExportAnswer(question, "le-1", "scope-1", "entity-1");
            
            expect(resolveMasterDataBatch).toHaveBeenCalled();
            expect(res.groupDisplayStyle).toBe('COMPACT');
            expect(res.groupFields).toBeDefined();
            expect(res.groupFields?.length).toBe(2);
            expect(res.groupFields?.[0].label).toBe('Field 1');
            expect(res.groupFields?.[0].displayValue).toBe('Value A');
            expect(res.groupFields?.[1].displayValue).toBe('Value B');
        });

        it('13. empty groups return proper empty state without displaying JSON', async () => {
            const question = { status: 'DRAFT', masterQuestionGroupId: 'group-1' };
            const { getMasterFieldGroup, getMasterFieldDefinition } = await import('@/services/masterData/definitionService');
            const { resolveMasterDataBatch } = await import('@/actions/kyc-query');
            
            vi.mocked(getMasterFieldGroup).mockResolvedValue({
                key: 'group-1',
                displayStyle: 'LIST',
                items: [{ fieldNo: 1, order: 1 }]
            } as any);

            vi.mocked(getMasterFieldDefinition).mockImplementation(async (fieldNo: number) => ({
                fieldNo, fieldName: `Field ${fieldNo}`, appDataType: 'STRING', isMultiValue: false, profileConfig: null
            } as any));

            vi.mocked(resolveMasterDataBatch).mockResolvedValue({
                [question.id]: {} // No values returned
            } as any);

            vi.mocked(prisma.fieldClaim.findMany).mockResolvedValue([]);
            vi.mocked((prisma as any).sourceFieldMapping.findMany).mockResolvedValue([]);
            vi.mocked(KycStateService.resolveAllAttachments).mockResolvedValue(new Map());

            const res = await resolveExportAnswer(question, "le-1", "scope-1", "entity-1");
            
            expect(res.answerState).toBe("NO_RESPONSE");
            expect(res.displayValue).toBe("No response recorded");
            expect(res.groupFields).toBeUndefined(); // Should omit the array entirely
        });
        it('14. extracts attachments for single fields', async () => {
            const question = { status: 'DRAFT', masterFieldNo: 100 };
            
            vi.mocked(getFieldDetail).mockResolvedValue({
                isRepeating: false,
                dataType: 'STRING',
                displayState: 'HAS_VALUE'
            } as any);

            vi.mocked(KycStateService.getAuthoritativeValue).mockResolvedValue({
                value: 'Has attachment',
                sourceType: 'USER_INPUT',
                sourceReference: null,
                assertedAt: new Date(),
                claimId: 'c1'
            } as any);

            const mockAttachments = new Map();
            mockAttachments.set(100, [{
                attachmentDocumentId: 'doc-1',
                documentName: 'file1.pdf'
            }]);
            vi.mocked(KycStateService.resolveAllAttachments).mockResolvedValue(mockAttachments);

            const res = await resolveExportAnswer(question, "le-1", "scope-1", "entity-1");
            
            expect(res.attachmentFilenames).toBeDefined();
            expect(res.attachmentFilenames).toEqual(['file1.pdf']);
        });

        it('15. extracts attachments for group fields', async () => {
            const question = { status: 'DRAFT', masterQuestionGroupId: 'group-1' };
            const { getMasterFieldGroup, getMasterFieldDefinition } = await import('@/services/masterData/definitionService');
            const { resolveMasterDataBatch } = await import('@/actions/kyc-query');
            
            vi.mocked(getMasterFieldGroup).mockResolvedValue({
                key: 'group-1',
                displayStyle: 'LIST',
                items: [{ fieldNo: 1, order: 1 }]
            } as any);

            vi.mocked(getMasterFieldDefinition).mockImplementation(async (fieldNo: number) => ({
                fieldNo, fieldName: `Field ${fieldNo}`, appDataType: 'STRING', isMultiValue: false, profileConfig: null
            } as any));

            vi.mocked(resolveMasterDataBatch).mockResolvedValue({
                [question.id]: {
                    1: {
                        value: 'Group field value',
                        source: 'USER_INPUT',
                        sourceReference: null,
                        updatedAt: new Date(),
                        isSynced: true,
                        attachments: [{ displayName: 'group-file.pdf' }]
                    }
                }
            } as any);

            vi.mocked(prisma.fieldClaim.findMany).mockResolvedValue([]);
            vi.mocked((prisma as any).sourceFieldMapping.findMany).mockResolvedValue([]);
            vi.mocked(KycStateService.resolveAllAttachments).mockResolvedValue(new Map());

            const res = await resolveExportAnswer(question, "le-1", "scope-1", "entity-1");
            
            expect(res.groupFields).toBeDefined();
            expect(res.groupFields?.[0].attachmentFilenames).toBeDefined();
            expect(res.groupFields?.[0].attachmentFilenames).toEqual(['group-file.pdf']);
        });
    
    describe('Identity guard relaxations (Localized Master Data)', () => {
        const fixedDate = new Date("2025-01-01T00:00:00Z");

        it('1. unresolved ClientLE (undefined subjectLeId) successfully exports mapped ADDRESS field', async () => {
            const question = { status: 'DRAFT', masterFieldNo: 138 };
            
            vi.mocked(getFieldDetail).mockResolvedValue({
                dataType: 'ADDRESS',
                isRepeating: false,
                displayState: 'HAS_VALUE'
            } as any);

            // Mock an ASSERTED authoritative claim for a localized entity
            vi.mocked(KycStateService.getAuthoritativeValue).mockResolvedValue({
                value: {
                    locality: 'London',
                    postalCode: 'EC2',
                    addressLines: ['123 Canonical Way']
                },
                sourceType: 'USER_INPUT',
                status: 'ASSERTED',
                assertedAt: fixedDate,
                claimId: 'claim-loc'
            } as any);

            vi.mocked(prisma.fieldClaim.findUnique).mockResolvedValue({
                id: 'claim-loc',
                verifiedBy: { name: 'Alice Local' }
            } as any);

            // Pass undefined for subjectLeId
            const res = await resolveExportAnswer(question, undefined, "scope-local", "entity-loc");
            
            expect(res.displayValue).toBe("123 Canonical Way, London, EC2");
            expect(res.answerState).toBe("HAS_VALUE");
            expect(res.sourceLabel).toBe("User input — Alice Local");
            expect(KycStateService.getAuthoritativeValue).toHaveBeenCalledWith(
                { subjectLeId: undefined, clientLEId: "entity-loc" },
                138,
                "scope-local",
                undefined
            );
        });

        it('2. resolved Legal Entity successfully exports VERIFIED mapped ADDRESS field', async () => {
            const question = { status: 'DRAFT', masterFieldNo: 138 };
            
            vi.mocked(getFieldDetail).mockResolvedValue({
                dataType: 'ADDRESS',
                isRepeating: false,
                displayState: 'HAS_VALUE'
            } as any);

            // Mock a VERIFIED authoritative claim for a resolved entity
            vi.mocked(KycStateService.getAuthoritativeValue).mockResolvedValue({
                value: {
                    locality: 'Verona',
                    postalCode: '37121',
                    addressLines: ['Via Verona 1']
                },
                sourceType: 'COMPANIES_HOUSE',
                status: 'VERIFIED',
                assertedAt: fixedDate,
                claimId: 'claim-glb'
            } as any);

            // Pass resolved subjectLeId
            const res = await resolveExportAnswer(question, "glb-subject", "scope-glb", "entity-glb");
            
            expect(res.displayValue).toBe("Via Verona 1, Verona, 37121");
            expect(res.answerState).toBe("HAS_VALUE");
            expect(res.sourceLabel).toBe("Companies House");
            expect(KycStateService.getAuthoritativeValue).toHaveBeenCalledWith(
                { subjectLeId: "glb-subject", clientLEId: "entity-glb" },
                138,
                "scope-glb",
                undefined
            );
        });

        it('3. unresolved ClientLE exports mapped TEXT field without regression', async () => {
            const question = { status: 'DRAFT', masterFieldNo: 21 }; // e.g. Legal Form
            
            vi.mocked(getFieldDetail).mockResolvedValue({
                dataType: 'TEXT',
                isRepeating: false,
                displayState: 'HAS_VALUE'
            } as any);

            vi.mocked(KycStateService.getAuthoritativeValue).mockResolvedValue({
                value: 'Limited Liability Company',
                sourceType: 'SYSTEM_DERIVED',
                status: 'VERIFIED',
                assertedAt: fixedDate
            } as any);

            const res = await resolveExportAnswer(question, undefined, "scope-txt", "entity-txt");
            
            expect(res.displayValue).toBe("Limited Liability Company");
            expect(res.answerState).toBe("HAS_VALUE");
        });
        
        
        
        it('5. resolves attachments correctly using entityId', async () => {
             const question = { status: 'DRAFT', masterFieldNo: 100 };
             vi.mocked(getFieldDetail).mockResolvedValue({
                 dataType: 'TEXT', isRepeating: false, displayState: 'HAS_VALUE'
             } as any);
             vi.mocked(KycStateService.getAuthoritativeValue).mockResolvedValue({
                 value: 'test', sourceType: 'USER_INPUT', status: 'ASSERTED', assertedAt: fixedDate
             } as any);
             
             const attachmentsMap = new Map();
             attachmentsMap.set(100, [{ documentName: 'test.pdf', attachmentDocumentId: 'doc-1' }]);
             vi.mocked(KycStateService.resolveAllAttachments).mockResolvedValue(attachmentsMap);
             
             const res = await resolveExportAnswer(question, undefined, "scope-att", "entity-att");
             
             expect(res.attachmentFilenames).toEqual(['test.pdf']);
             expect(KycStateService.resolveAllAttachments).toHaveBeenCalledWith(
                 { subjectLeId: undefined, clientLEId: 'entity-att' },
                 [100]
             );
        });
    });
});

}
);
