import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '@/lib/prisma';
import { KycWriteService } from '../KycWriteService';
import { getMasterFieldDefinition, listAllMasterGroupsWithItems } from '@/services/masterData/definitionService';
import { getComplexFieldConfig } from '@/lib/master-data/complex-field-config';
import { KycStateService } from '@/lib/kyc/KycStateService';

vi.mock('@/lib/prisma', () => ({
    default: {
        fieldClaim: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn(),
            update: vi.fn(),
            findMany: vi.fn(),
        },
        clientLE: {
            findUnique: vi.fn().mockResolvedValue({ id: 'le_1', legalEntityId: 'le_real_1' }),
        },
        ccParty: {
            findMany: vi.fn().mockResolvedValue([]),
        },
        ccAddress: {
            findMany: vi.fn().mockResolvedValue([]),
        },
        question: {
            findMany: vi.fn().mockResolvedValue([]),
        },
        fIEngagement: {
            findMany: vi.fn().mockResolvedValue([]),
        },
        $transaction: vi.fn((cb) => cb(prisma)),
    }
}));

vi.mock('@/services/masterData/definitionService', () => ({
    getMasterFieldDefinition: vi.fn(),
    listAllMasterGroupsWithItems: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/master-data/complex-field-config', () => ({
    getComplexFieldConfig: vi.fn(),
}));

vi.mock('@/lib/kyc/KycStateService', () => ({
    KycStateService: {
        resolveAllFields: vi.fn(),
        getAuthoritativeValue: vi.fn().mockResolvedValue(null),
        getAuthoritativeCollection: vi.fn().mockResolvedValue([]),
    }
}));

vi.mock('@/lib/kyc/FieldClaimService', () => ({
    FieldClaimService: {
        emitTombstone: vi.fn(),
        writeBackGraphEdge: vi.fn(),
        assertClaim: vi.fn(),
    },
}));

describe('Repeating FieldClaim Semantics', () => {
    let service: KycWriteService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new KycWriteService();
    });

    it('uses FIELD_{fieldNo} for multi-value fields lacking complex config (Field 999)', async () => {
        vi.mocked(getMasterFieldDefinition).mockResolvedValue(
            { fieldNo: 999, isMultiValue: true, appDataType: 'PARTY', categoryId: 'CAT_1' } as any
        );
        vi.mocked(getComplexFieldConfig).mockReturnValue(undefined);
        vi.mocked(prisma.fieldClaim.findMany).mockResolvedValue([]);
        // Mock findFirst to return undefined so we trigger create
        vi.mocked(prisma.fieldClaim.findFirst).mockResolvedValue(null);

        const candidate = {
            source: 'COMPANIES_HOUSE',
            sourceKey: 'ch_123',
            syncMode: 'SNAPSHOT_SYNC',
            fieldNo: 999,
            value: [{ forenames: 'John', rowKey: 'dir_1' }],
            sourcePayloadRef: 'payload_1',
            effectiveFrom: new Date(),
        };

        await service.applyFieldCandidate('le_1', candidate as any, undefined, 'CLIENT_LE');

        expect(prisma.fieldClaim.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                collectionId: 'FIELD_999'
            })
        }));

        const FieldClaimService = await import('@/lib/kyc/FieldClaimService');
        expect(FieldClaimService.FieldClaimService.assertClaim).toHaveBeenCalledWith(expect.objectContaining({
            collectionId: 'FIELD_999',
            instanceId: 'COMPANIES_HOUSE::ch_123::dir_1'
        }));
    });

    it('archives missing source rows using idempotency semantics', async () => {
        vi.mocked(getMasterFieldDefinition).mockResolvedValue(
            { fieldNo: 999, isMultiValue: true, appDataType: 'PARTY' } as any
        );
        vi.mocked(getComplexFieldConfig).mockReturnValue(undefined);
        
        vi.mocked(prisma.fieldClaim.findMany).mockResolvedValue([
            { id: 'claim_1', instanceId: 'dir_1', valueJson: { forenames: 'John' }, sourceType: 'COMPANIES_HOUSE', collectionId: 'FIELD_999', isActive: true },
            { id: 'claim_missing', instanceId: 'dir_2', valueJson: { forenames: 'Old' }, sourceType: 'COMPANIES_HOUSE', collectionId: 'FIELD_999', isActive: true },
        ] as any);

        const candidate = {
            source: 'COMPANIES_HOUSE',
            sourceKey: 'ch_123',
            syncMode: 'SNAPSHOT_SYNC',
            fieldNo: 999,
            value: [{ forenames: 'John', rowKey: 'dir_1' }],
        };

        await service.applyFieldCandidate('le_1', candidate as any, undefined, 'CLIENT_LE');

        const FieldClaimService = await import('@/lib/kyc/FieldClaimService');
        expect(FieldClaimService.FieldClaimService.emitTombstone).toHaveBeenCalledWith(
            expect.objectContaining({ subjectLeId: 'le_real_1' }),
            999,
            'FIELD_999',
            'dir_2',
            null,
            'COMPANIES_HOUSE'
        );
    });

    it('preserves DIRECTORS for Field 63', async () => {
        vi.mocked(getMasterFieldDefinition).mockResolvedValue(
            { fieldNo: 63, isMultiValue: true, appDataType: 'PARTY' } as any
        );
        vi.mocked(getComplexFieldConfig).mockReturnValue({ collectionId: 'DIRECTORS' } as any);
        vi.mocked(prisma.fieldClaim.findMany).mockResolvedValue([]);

        const candidate = {
            source: 'COMPANIES_HOUSE',
            syncMode: 'SNAPSHOT_SYNC',
            fieldNo: 63,
            value: [{ forenames: 'Jane', rowKey: 'dir_jane' }],
        };

        await service.applyFieldCandidate('le_1', candidate as any, undefined, 'CLIENT_LE');

        expect(prisma.fieldClaim.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                collectionId: 'DIRECTORS'
            })
        }));
    });
});
