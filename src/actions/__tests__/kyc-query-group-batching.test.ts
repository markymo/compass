import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getFieldDetail } from '../kyc-query';
import { KycStateService } from '@/lib/kyc/KycStateService';
import * as masterDataHelpers from '@/services/masterData/definitionService';

// Mock KycStateService
vi.mock('@/lib/kyc/KycStateService', async (importOriginal) => {
    const actual = await importOriginal() as any;
    return {
        KycStateService: {
            ...actual.KycStateService,
            evaluateSyncAttempt: actual.KycStateService.evaluateSyncAttempt,
            calculateDisplayState: actual.KycStateService.calculateDisplayState,
            resolveAllFields: vi.fn(),
            resolveAllAttachments: vi.fn(),
            getAuthoritativeValue: vi.fn(),
            getAuthoritativeAttachments: vi.fn(),
            getAuthoritativeCollection: vi.fn(),
            resolveScopeId: vi.fn().mockResolvedValue('scope_1'),
        }
    };
});

// Mock Prisma
vi.mock('@/lib/prisma', () => {
    return {
        default: {
            clientLE: {
                findUnique: vi.fn().mockResolvedValue({ id: 'cle_1', legalEntityId: 'le_1' })
            },
            masterFieldGraphBinding: {
                findMany: vi.fn().mockResolvedValue([])
            },
            cCParty: {
                findMany: vi.fn().mockResolvedValue([])
            },
            cCAddress: {
                findMany: vi.fn().mockResolvedValue([])
            },
            sourceFieldMapping: {
                findMany: vi.fn().mockResolvedValue([])
            },
            masterFieldAssignment: {
                findUnique: vi.fn().mockResolvedValue(null)
            },
            fieldClaim: {
                findMany: vi.fn().mockResolvedValue([]),
                findFirst: vi.fn().mockResolvedValue(null)
            },
            $queryRaw: vi.fn().mockResolvedValue([])
        }
    };
});

// Mock master data
vi.mock('@/services/masterData/definitionService', () => {
    return {
        getMasterFieldGroup: vi.fn(),
        getMasterFieldDefinition: vi.fn(),
        getComplexFieldConfig: vi.fn().mockReturnValue(null),
    };
});

describe('getFieldDetail - Group Path Batching', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('uses the batch resolvers for group paths instead of N+1 sequential loops', async () => {
        const mockGroup = {
            id: 'grp_1',
            label: 'Test Group',
            items: [
                { fieldNo: 101, isRequired: false },
                { fieldNo: 102, isRequired: false },
                { fieldNo: 103, isRequired: false },
            ]
        };

        const mockDefs = {
            101: { fieldNo: 101, fieldName: 'Field 1', appDataType: 'STRING', isMultiValue: false, allowAttachments: true },
            102: { fieldNo: 102, fieldName: 'Field 2', appDataType: 'STRING', isMultiValue: true, allowAttachments: false },
            103: { fieldNo: 103, fieldName: 'Field 3', appDataType: 'STRING', isMultiValue: false, allowAttachments: true },
        };

        vi.mocked(masterDataHelpers.getMasterFieldGroup).mockResolvedValue(mockGroup as any);
        vi.mocked(masterDataHelpers.getMasterFieldDefinition).mockImplementation(async (fieldNo) => mockDefs[fieldNo as keyof typeof mockDefs] as any);

        const mockValuesMap = new Map();
        mockValuesMap.set(101, { value: 'val1', isScoped: false, assertedAt: new Date(), evidenceProvider: 'SYSTEM' });
        mockValuesMap.set(102, [
            { value: 'val2', isScoped: true, assertedAt: new Date() }
        ]);
        mockValuesMap.set(103, null);

        const mockAttachmentsMap = new Map();
        mockAttachmentsMap.set(101, [
            { instanceId: 'inst_1', attachmentDocumentId: 'doc_1', assertedAt: new Date() }
        ]);
        mockAttachmentsMap.set(103, []); // Allow attachments but none present

        vi.mocked(KycStateService.resolveAllFields).mockResolvedValue(mockValuesMap);
        vi.mocked(KycStateService.resolveAllAttachments).mockResolvedValue(mockAttachmentsMap);

        const result = await getFieldDetail('cle_1', 0, 'CLIENT_LE', undefined, 'grp_1');

        expect(result.fieldName).toBe('Test Group');
        expect(result.groupFields).toHaveLength(3);

        // Verify that the batch APIs were called EXACTLY ONCE each
        expect(KycStateService.resolveAllFields).toHaveBeenCalledTimes(1);
        expect(KycStateService.resolveAllAttachments).toHaveBeenCalledTimes(1);

        // Verify the per-field APIs were NOT called
        expect(KycStateService.getAuthoritativeValue).not.toHaveBeenCalled();
        expect(KycStateService.getAuthoritativeCollection).not.toHaveBeenCalled();
        expect(KycStateService.getAuthoritativeAttachments).not.toHaveBeenCalled();

        // Verify the exact shape of the payload sent to resolveAllFields
        expect(KycStateService.resolveAllFields).toHaveBeenCalledWith(
            { subjectLeId: 'le_1', clientLEId: 'cle_1' },
            [
                { fieldNo: 101, isMultiValue: false, collectionId: undefined },
                { fieldNo: 102, isMultiValue: true, collectionId: undefined },
                { fieldNo: 103, isMultiValue: false, collectionId: undefined }
            ],
            'scope_1'
        );

        // Verify the exact shape of the payload sent to resolveAllAttachments
        expect(KycStateService.resolveAllAttachments).toHaveBeenCalledWith(
            { subjectLeId: 'le_1', clientLEId: 'cle_1' },
            [101, 103] // 102 does not allow attachments
        );

        // Verify that the attachment mappings correctly landed in the UI layer without cross-contamination
        const f101 = result.groupFields!.find(f => f.fieldNo === 101)!;
        expect((f101.canonicalDisplayModel.value as any).rawValue).toBe('val1');
        expect(f101.canonicalDisplayModel.allowAttachments).toBe(true);
        expect(f101.canonicalDisplayModel.attachments).toHaveLength(1);
        expect(f101.canonicalDisplayModel.attachments[0].instanceId).toBe('inst_1');

        const f102 = result.groupFields!.find(f => f.fieldNo === 102)!;
        expect(f102.canonicalDisplayModel.value).toEqual({
            kind: 'collection',
            items: [
                {
                    value: { kind: 'scalar', display: 'val2', rawValue: 'val2' },
                    source: undefined
                }
            ]
        });
        expect(f102.canonicalDisplayModel.allowAttachments).toBe(false);
        expect(f102.canonicalDisplayModel.attachments).toHaveLength(0);

        const f103 = result.groupFields!.find(f => f.fieldNo === 103)!;
        expect(f103.canonicalDisplayModel.value).toEqual({ kind: 'empty' });
        expect(f103.canonicalDisplayModel.allowAttachments).toBe(true);
        expect(f103.canonicalDisplayModel.attachments).toHaveLength(0);
    });
});
