import { describe, it, expect, vi } from 'vitest';
import { getFieldDetail } from '../kyc-query';
import * as defService from '@/services/masterData/definitionService';
import { KycStateService } from '@/lib/kyc/KycStateService';
import gleifLegalJurisdictions from '../../../scripts/gleif-legal-jurisdictions.json';

vi.mock('@/services/masterData/definitionService', () => ({
    getMasterFieldDefinition: vi.fn(),
    getMasterFieldGroup: vi.fn(),
}));

vi.mock('@/lib/kyc/KycStateService', async (importOriginal) => {
    const actual = await importOriginal() as any;
    return {
        KycStateService: {
            ...actual.KycStateService,
            evaluateSyncAttempt: actual.KycStateService.evaluateSyncAttempt,
            calculateDisplayState: actual.KycStateService.calculateDisplayState,
            resolveScopeId: vi.fn().mockResolvedValue('test-scope'),
            getAuthoritativeValue: vi.fn(),
            getAuthoritativeCollection: vi.fn().mockResolvedValue(null),
            resolveAllAttachments: vi.fn().mockResolvedValue(new Map()),
        }
    };
});

vi.mock('@/lib/prisma', () => ({
    default: {
        clientLE: {
            findUnique: vi.fn().mockResolvedValue({
                id: 'cle_1',
                legalEntityId: 'le_1',
                gleifFetchedAt: new Date('2026-07-04T00:00:00Z'),
                registryReferences: []
            })
        },
        fieldClaim: { findMany: vi.fn().mockResolvedValue([]) },
        masterFieldGraphBinding: { findMany: vi.fn().mockResolvedValue([]) },
        cCParty: { findMany: vi.fn().mockResolvedValue([]) },
        masterFieldAssignment: { findUnique: vi.fn().mockResolvedValue(null) },
        $queryRaw: vi.fn().mockResolvedValue([]),
        sourceFieldMapping: { findMany: vi.fn().mockResolvedValue([]) },
        enrichmentRun: {
            findFirst: vi.fn().mockResolvedValue(null),
            findMany: vi.fn().mockResolvedValue([])
        },
    }
}));

describe('ONP-203 — getFieldDetail Editor Options vs Canonical Display Resolution', () => {
    const gleifOptionSet = {
        id: '192aa8b1-a1bd-4e69-b50c-a9f06f61cf53',
        name: 'GLEIF_Legal_Jurisdictions',
        options: gleifLegalJurisdictions
    };

    it('F134 (TEXT): returns options=undefined for editor, but resolves canonical display label via reference options', async () => {
        vi.mocked(defService.getMasterFieldDefinition).mockResolvedValue({
            fieldNo: 134,
            fieldName: 'Country of formation',
            appDataType: 'TEXT',
            isMultiValue: false,
            optionSet: gleifOptionSet
        } as any);

        vi.mocked(KycStateService.getAuthoritativeValue).mockResolvedValue({
            value: 'US-DE',
            sourceType: 'GLEIF',
            sourceReference: 'entity.jurisdiction',
            assertedAt: new Date('2026-09-01T00:00:00Z'),
            confidenceScore: 1.0,
            claimId: 'claim_f134'
        } as any);

        const result = await getFieldDetail('cle_1', 134, 'CLIENT_LE');

        // 1. Editor contract: options must NOT be exposed for TEXT fields
        expect(result.options).toBeUndefined();

        // 2. Current raw value remains untouched
        expect(result.current?.value).toBe('US-DE');

        // 3. Canonical display model resolves label correctly using referenceOptions
        expect((result as any).canonicalDisplayModel).toBeDefined();
        const displayModel = (result as any).canonicalDisplayModel;
        expect(displayModel.value.kind).toBe('scalar');
        expect(displayModel.value.rawValue).toBe('US-DE');
        expect(displayModel.value.display).toBe('US-DE \u2013 Delaware (United States of America)');
    });

    it('F143 (SELECT): returns populated options for editor and resolves canonical display label', async () => {
        vi.mocked(defService.getMasterFieldDefinition).mockResolvedValue({
            fieldNo: 143,
            fieldName: 'Tax residence 1',
            appDataType: 'SELECT',
            isMultiValue: false,
            optionSet: gleifOptionSet
        } as any);

        vi.mocked(KycStateService.getAuthoritativeValue).mockResolvedValue({
            value: 'FR',
            sourceType: 'USER_INPUT',
            sourceReference: null,
            assertedAt: new Date('2026-09-01T00:00:00Z'),
            confidenceScore: 1.0,
            claimId: 'claim_f143'
        } as any);

        const result = await getFieldDetail('cle_1', 143, 'CLIENT_LE');

        // 1. Editor contract: options MUST be exposed for SELECT fields
        expect(result.options).toBeDefined();
        expect(Array.isArray(result.options)).toBe(true);
        expect(result.options?.length).toBe(324);
        expect(result.options?.find((o: any) => o.value === 'FR')?.label).toBe('FR \u2013 France');

        // 2. Current raw value remains untouched
        expect(result.current?.value).toBe('FR');

        // 3. Canonical display model resolves label correctly
        expect((result as any).canonicalDisplayModel).toBeDefined();
        const displayModel = (result as any).canonicalDisplayModel;
        expect(displayModel.value.kind).toBe('scalar');
        expect(displayModel.value.rawValue).toBe('FR');
        expect(displayModel.value.display).toBe('FR \u2013 France');
    });
});
