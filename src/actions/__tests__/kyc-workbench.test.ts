import { describe, it, expect, vi } from 'vitest';
vi.mock('next-auth', () => ({ default: vi.fn(() => ({ handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() })), getServerSession: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { getWorkbench4Data } from '../kyc-workbench';
import prisma from '@/lib/prisma';
import * as kycQuery from '../kyc-query';
import * as definitionService from '@/services/masterData/definitionService';
import * as sourceLabelServer from '@/lib/kyc/source-label.server';
import { KycStateService } from '@/lib/kyc/KycStateService';

vi.mock('@/lib/prisma', () => ({
    default: {
        clientLE: { findUnique: vi.fn() },
        fieldClaim: { findMany: vi.fn() },
        sourceFieldMapping: { findMany: vi.fn() },
        customFieldDefinition: { findMany: vi.fn() },
        clientLEOwner: { findFirst: vi.fn() }
    }
}));
vi.mock('../kyc-query', () => ({
    getConsoleQuestions: vi.fn(),
    resolveMasterDataBatch: vi.fn()
}));
vi.mock('@/lib/kyc/source-label.server', () => ({ fetchRaNameLookup: vi.fn() }));
vi.mock('@/lib/kyc/KycStateService', () => ({ 
    KycStateService: { 
        resolveScopeId: vi.fn(),
        resolveAllFields: vi.fn().mockResolvedValue([]),
        resolveAllAttachments: vi.fn().mockResolvedValue(new Map())
    } 
}));
vi.mock('@/services/masterData/definitionService', () => ({
    listAllMasterFields: vi.fn(),
    listAllMasterGroupsWithItems: vi.fn()
}));

describe('getWorkbench4Data', () => {
    it('attaches canonicalDisplayModel for custom fields', async () => {
        const customDefId = 'custom-123';
        vi.mocked(kycQuery.getConsoleQuestions).mockResolvedValueOnce([
            { id: 'q1', customFieldDefinitionId: customDefId, questionnaireName: 'Q', engagementOrgName: 'Org' } as any
        ]);
        vi.mocked(definitionService.listAllMasterFields).mockResolvedValueOnce([]);
        vi.mocked(definitionService.listAllMasterGroupsWithItems).mockResolvedValueOnce([]);
        vi.mocked(sourceLabelServer.fetchRaNameLookup).mockResolvedValueOnce({});
        vi.mocked(KycStateService.resolveScopeId).mockResolvedValueOnce('scope1');
        vi.mocked(prisma.clientLE.findUnique).mockResolvedValueOnce({
            legalEntityId: 'le-1',
            customData: {
                [customDefId]: { value: 'Custom Answer', source: 'USER_INPUT', timestamp: '2026-01-01' }
            }
        } as any);
        vi.mocked(prisma.fieldClaim.findMany).mockResolvedValueOnce([]);
        vi.mocked((prisma as any).sourceFieldMapping.findMany).mockResolvedValueOnce([]);
        vi.mocked(prisma.customFieldDefinition.findMany).mockResolvedValueOnce([
            { id: customDefId, label: 'My Custom Field', dataType: 'Text' } as any
        ]);
        vi.mocked(kycQuery.resolveMasterDataBatch).mockResolvedValueOnce({});
        vi.mocked(prisma.clientLEOwner.findFirst).mockResolvedValueOnce({ partyId: 'org1' } as any);

        const result = await getWorkbench4Data('client-le-1');

        expect(result.questions).toHaveLength(1);
        const q = result.questions[0] as any;
        expect(q.masterDataValue).toBe('Custom Answer');
        expect(q.canonicalDisplayModel).toBeDefined();
        expect(q.canonicalDisplayModel.fieldNo).toBe(-1);
        expect(q.canonicalDisplayModel.label).toBe('My Custom Field');
        expect(q.canonicalDisplayModel.state).toBe('POPULATED');
        expect(q.canonicalDisplayModel.value.display).toBe('Custom Answer');
    });
});
