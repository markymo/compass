import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mock prisma before importing the module under test ---
vi.mock('@/lib/prisma', () => {
    const mock = {
        enrichmentRun: {
            findUnique: vi.fn(),
        },
        sourceFieldMapping: {
            findMany: vi.fn(),
        },
        masterFieldDefinition: {
            // Default: most fields are single-value (isMultiValue=false).
            // Individual tests override this for Field 5.
            findUnique: vi.fn().mockResolvedValue({ isMultiValue: false }),
        },
        registryAuthority: {
            // Default: null mappingSourceKey — engine falls back to raId.
            // Override per-test for multi-RA group behaviour.
            findUnique: vi.fn().mockResolvedValue({ mappingSourceKey: null }),
        },
    };
    return { default: mock };
});

import prisma from '@/lib/prisma';
import { RegistryMappingEngine } from '../RegistryMappingEngine';

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

const prismaMock = prisma as any;

function makeRun(overrides: Record<string, any> = {}) {
    return {
        id: 'run-001',
        registrationAuthorityId: 'RA000585',
        sourcePayloads: [],
        baselineExtracts: [],
        ...overrides,
    };
}

function makeMapping(overrides: Record<string, any> = {}) {
    return {
        id: `map-${Math.random()}`,
        sourceType: 'REGISTRATION_AUTHORITY',
        sourceReference: 'COMPANIES_HOUSE',
        mappingScope: 'RAW_PAYLOAD',
        payloadSubtype: 'COMPANY_PROFILE',
        sourcePath: 'company_name',
        targetFieldNo: 3,
        confidenceDefault: 1.0,
        transformType: 'DIRECT',
        transformConfig: null,
        priority: 10,
        isActive: true,
        createdAt: new Date(),
        ...overrides,
    };
}

function makePayload(subtype: string, data: Record<string, any>) {
    return { payloadSubtype: subtype, payload: data };
}

// ────────────────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────────────────

describe('RegistryMappingEngine', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset to default: mappingSourceKey = null (engine falls back to raId)
        prismaMock.registryAuthority.findUnique.mockResolvedValue({ mappingSourceKey: null });
    });

    // T1 ─ Higher-priority mapping wins when two map the same field
    it('T1: lower priority integer wins within same source scope', async () => {
        const run = makeRun({
            registrationAuthorityId: 'RA000585',
            sourcePayloads: [makePayload('COMPANY_PROFILE', { primary_name: 'Winner Ltd', fallback_name: 'Loser Ltd' })],
        });

        prismaMock.enrichmentRun.findUnique.mockResolvedValue(run);
        prismaMock.registryAuthority.findUnique.mockResolvedValue({ mappingSourceKey: 'COMPANIES_HOUSE' });

        prismaMock.sourceFieldMapping.findMany.mockResolvedValue([
            makeMapping({ sourceReference: 'COMPANIES_HOUSE', sourcePath: 'fallback_name', targetFieldNo: 3, priority: 50 }),
            makeMapping({ sourceReference: 'COMPANIES_HOUSE', sourcePath: 'primary_name',  targetFieldNo: 3, priority: 5 }),
        ]);

        const candidates = await RegistryMappingEngine.mapEnrichmentRun('run-001');
        expect(candidates).toHaveLength(1);
        expect(candidates[0].value).toBe('Winner Ltd');
    });

    // T2 ─ mappingSourceKey resolution: RA000587 run uses COMPANIES_HOUSE mappings
    it('T2: engine resolves COMPANIES_HOUSE mappings for an RA000587 run', async () => {
        const run = makeRun({
            registrationAuthorityId: 'RA000587',
            sourcePayloads: [makePayload('COMPANY_PROFILE', { locality: 'Belfast' })],
        });

        prismaMock.enrichmentRun.findUnique.mockResolvedValue(run);
        // RA000587 → mappingSourceKey = "COMPANIES_HOUSE"
        prismaMock.registryAuthority.findUnique.mockResolvedValue({ mappingSourceKey: 'COMPANIES_HOUSE' });

        prismaMock.sourceFieldMapping.findMany.mockResolvedValue([
            makeMapping({ sourceReference: 'COMPANIES_HOUSE', sourcePath: 'locality', targetFieldNo: 7, priority: 10 }),
        ]);

        const candidates = await RegistryMappingEngine.mapEnrichmentRun('run-001');
        expect(candidates).toHaveLength(1);
        expect(candidates[0].fieldNo).toBe(7);
        expect(candidates[0].value).toBe('Belfast');
        // sourceKey should reflect the canonical mapping source identity
        expect(candidates[0].sourceKey).toBe('COMPANIES_HOUSE');
    });

    // T3 ─ Explicit priority integer respected within same scope (was T3)
    it('T3: lower priority integer wins within same RA scope', async () => {
        const run = makeRun({
            registrationAuthorityId: 'RA000585',
            sourcePayloads: [makePayload('COMPANY_PROFILE', { primary_name: 'Winner Ltd', fallback_name: 'Loser Ltd' })],
        });

        prismaMock.enrichmentRun.findUnique.mockResolvedValue(run);
        prismaMock.registryAuthority.findUnique.mockResolvedValue({ mappingSourceKey: 'COMPANIES_HOUSE' });

        prismaMock.sourceFieldMapping.findMany.mockResolvedValue([
            makeMapping({ sourceReference: 'COMPANIES_HOUSE', sourcePath: 'fallback_name', targetFieldNo: 3, priority: 50 }),
            makeMapping({ sourceReference: 'COMPANIES_HOUSE', sourcePath: 'primary_name',  targetFieldNo: 3, priority: 5 }),
        ]);

        const candidates = await RegistryMappingEngine.mapEnrichmentRun('run-001');
        expect(candidates).toHaveLength(1);
        expect(candidates[0].value).toBe('Winner Ltd');
    });

    // T4 ─ Returns empty array when no mappings exist
    it('T4: returns empty array when no mappings exist for RA, does not throw', async () => {
        const run = makeRun();
        prismaMock.enrichmentRun.findUnique.mockResolvedValue(run);
        prismaMock.registryAuthority.findUnique.mockResolvedValue({ mappingSourceKey: 'COMPANIES_HOUSE' });
        prismaMock.sourceFieldMapping.findMany.mockResolvedValue([]);

        const candidates = await RegistryMappingEngine.mapEnrichmentRun('run-001');
        expect(candidates).toEqual([]);
    });

    // T5 ─ RAW_PAYLOAD scope resolves from correct subtype
    it('T5: RAW_PAYLOAD mapping resolves from correct payloadSubtype, not from a different subtype', async () => {
        const run = makeRun({
            registrationAuthorityId: 'RA000585',
            sourcePayloads: [
                makePayload('COMPANY_PROFILE', { company_name: 'Correct Ltd' }),
                makePayload('OFFICERS', { company_name: 'Wrong Ltd' }),  // same path, wrong subtype
            ],
        });

        prismaMock.enrichmentRun.findUnique.mockResolvedValue(run);
        prismaMock.registryAuthority.findUnique.mockResolvedValue({ mappingSourceKey: 'COMPANIES_HOUSE' });

        prismaMock.sourceFieldMapping.findMany.mockResolvedValue([
            makeMapping({ mappingScope: 'RAW_PAYLOAD', payloadSubtype: 'COMPANY_PROFILE', sourcePath: 'company_name', targetFieldNo: 3 }),
        ]);

        const candidates = await RegistryMappingEngine.mapEnrichmentRun('run-001');
        expect(candidates).toHaveLength(1);
        expect(candidates[0].value).toBe('Correct Ltd');
    });

    // T6 ─ TO_NAME_HISTORY_LIST transform returns structured objects per name row
    it('T6: TO_NAME_HISTORY_LIST transform produces one structured candidate object per previous name', async () => {
        const previousNames = [
            { name: 'Old Name Alpha', ceased_on: '2020-01-01', effective_from: '2015-06-01' },
            { name: 'Old Name Beta',  ceased_on: '2018-06-01', effective_from: '2010-01-01' },
        ];

        const run = makeRun({
            registrationAuthorityId: 'RA000585',
            sourcePayloads: [makePayload('COMPANY_PROFILE', { previous_company_names: previousNames })],
        });

        prismaMock.enrichmentRun.findUnique.mockResolvedValue(run);
        prismaMock.registryAuthority.findUnique.mockResolvedValue({ mappingSourceKey: 'COMPANIES_HOUSE' });
        // Field 5 is multi-value
        prismaMock.masterFieldDefinition.findUnique.mockResolvedValue({ isMultiValue: true });

        prismaMock.sourceFieldMapping.findMany.mockResolvedValue([
            makeMapping({ sourcePath: 'previous_company_names', targetFieldNo: 5, transformType: 'TO_NAME_HISTORY_LIST' }),
        ]);

        const candidates = await RegistryMappingEngine.mapEnrichmentRun('run-001');
        expect(candidates).toHaveLength(1);
        expect(candidates[0].fieldNo).toBe(5);
        // Value should be an array of structured objects
        expect(Array.isArray(candidates[0].value)).toBe(true);
        const items = candidates[0].value as any[];
        expect(items).toHaveLength(2);
        expect(items[0].name).toBe('Old Name Alpha');
        expect(items[0].effectiveTo).toBe('2020-01-01');
        expect(items[1].name).toBe('Old Name Beta');
    });

    // T7 ─ sourceKey reflects mappingSourceKey, not raId
    it('T7: FieldCandidate.sourceKey equals mappingSourceKey (COMPANIES_HOUSE), not the raw RA code', async () => {
        const previousNames = [{ name: 'Former Name Plc', ceased_on: '2019-01-01', effective_from: '2010-01-01' }];

        const run = makeRun({
            registrationAuthorityId: 'RA000587',  // NI variant
            sourcePayloads: [makePayload('COMPANY_PROFILE', { previous_company_names: previousNames })],
        });

        prismaMock.enrichmentRun.findUnique.mockResolvedValue(run);
        // RA000587 resolves to COMPANIES_HOUSE
        prismaMock.registryAuthority.findUnique.mockResolvedValue({ mappingSourceKey: 'COMPANIES_HOUSE' });
        // Field 5 is multi-value
        prismaMock.masterFieldDefinition.findUnique.mockResolvedValue({ isMultiValue: true });

        prismaMock.sourceFieldMapping.findMany.mockResolvedValue([
            makeMapping({
                sourceReference: 'COMPANIES_HOUSE',
                sourcePath: 'previous_company_names',
                targetFieldNo: 5,
                transformType: 'TO_NAME_HISTORY_LIST',
            }),
        ]);

        const candidates = await RegistryMappingEngine.mapEnrichmentRun('run-001');
        expect(candidates).toHaveLength(1);
        const c = candidates[0];
        expect(c.fieldNo).toBe(5);
        expect(Array.isArray(c.value)).toBe(true);
        expect(c.source).toBe('REGISTRATION_AUTHORITY');
        // sourceKey is now the mappingSourceKey, not the raw GLEIF RA code
        expect(c.sourceKey).toBe('COMPANIES_HOUSE');
    });

    // T8 ─ Returns empty when enrichmentRun not found
    it('T8: returns empty array and does not throw when EnrichmentRun is not found', async () => {
        prismaMock.enrichmentRun.findUnique.mockResolvedValue(null);

        const candidates = await RegistryMappingEngine.mapEnrichmentRun('nonexistent-run');
        expect(candidates).toEqual([]);
    });

    // T9 ─ Single-RA authority: mappingSourceKey null falls back to raId
    it('T9: engine falls back to raId as sourceReference when authority.mappingSourceKey is null', async () => {
        const run = makeRun({
            registrationAuthorityId: 'RA000192',
            sourcePayloads: [makePayload('COMPANY_PROFILE', { denomination: 'Société France SARL' })],
        });

        prismaMock.enrichmentRun.findUnique.mockResolvedValue(run);
        // France: no group key — mappingSourceKey is null → engine uses raId "RA000192"
        prismaMock.registryAuthority.findUnique.mockResolvedValue({ mappingSourceKey: null });

        prismaMock.sourceFieldMapping.findMany.mockResolvedValue([
            makeMapping({ sourceReference: 'RA000192', sourcePath: 'denomination', targetFieldNo: 3, priority: 10 }),
        ]);

        const candidates = await RegistryMappingEngine.mapEnrichmentRun('run-001');
        expect(candidates).toHaveLength(1);
        expect(candidates[0].value).toBe('Société France SARL');
        expect(candidates[0].sourceKey).toBe('RA000192');
    });

    // T10 ─ run with null registrationAuthorityId returns empty cleanly
    it('T10: returns empty array cleanly when run has no registrationAuthorityId', async () => {
        const run = makeRun({ registrationAuthorityId: null, sourcePayloads: [] });
        prismaMock.enrichmentRun.findUnique.mockResolvedValue(run);
        // registryAuthority.findUnique will not be called (raId is null)
        prismaMock.sourceFieldMapping.findMany.mockResolvedValue([]);

        const candidates = await RegistryMappingEngine.mapEnrichmentRun('run-001');
        expect(candidates).toEqual([]);
    });
});
