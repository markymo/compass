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
        sourceReference: 'RA000585',
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
    });

    // T1 ─ RA-scoped rule shadows global rule for same field
    it('T1: RA-scoped rule shadows global fallback for same targetFieldNo', async () => {
        const run = makeRun({
            registrationAuthorityId: 'RA000585',
            sourcePayloads: [makePayload('COMPANY_PROFILE', { company_name: 'Scoped Ltd', generic_name: 'Global Ltd' })],
        });

        prismaMock.enrichmentRun.findUnique.mockResolvedValue(run);

        prismaMock.sourceFieldMapping.findMany.mockResolvedValue([
            // Scoped rule (should win)
            makeMapping({ sourceReference: 'RA000585', sourcePath: 'company_name', targetFieldNo: 3, priority: 10 }),
            // Global fallback (should be ignored)
            makeMapping({ sourceReference: null, sourcePath: 'generic_name', targetFieldNo: 3, priority: 5 }),
        ]);

        const candidates = await RegistryMappingEngine.mapEnrichmentRun('run-001');
        expect(candidates).toHaveLength(1);
        expect(candidates[0].fieldNo).toBe(3);
        expect(candidates[0].value).toBe('Scoped Ltd');
    });

    // T2 ─ Global rule applies when no RA-scoped rule exists
    it('T2: global rule (null sourceReference) resolves when no RA-scoped rule exists', async () => {
        const run = makeRun({
            registrationAuthorityId: 'RA000585',
            sourcePayloads: [makePayload('COMPANY_PROFILE', { locality: 'Edinburgh' })],
        });

        prismaMock.enrichmentRun.findUnique.mockResolvedValue(run);

        prismaMock.sourceFieldMapping.findMany.mockResolvedValue([
            makeMapping({ sourceReference: null, sourcePath: 'locality', targetFieldNo: 7, priority: 50 }),
        ]);

        const candidates = await RegistryMappingEngine.mapEnrichmentRun('run-001');
        expect(candidates).toHaveLength(1);
        expect(candidates[0].fieldNo).toBe(7);
        expect(candidates[0].value).toBe('Edinburgh');
    });

    // T3 ─ Explicit priority integer respected within same scope
    it('T3: lower priority integer wins within same RA scope', async () => {
        const run = makeRun({
            registrationAuthorityId: 'RA000585',
            sourcePayloads: [makePayload('COMPANY_PROFILE', { primary_name: 'Winner Ltd', fallback_name: 'Loser Ltd' })],
        });

        prismaMock.enrichmentRun.findUnique.mockResolvedValue(run);

        prismaMock.sourceFieldMapping.findMany.mockResolvedValue([
            makeMapping({ sourceReference: 'RA000585', sourcePath: 'fallback_name', targetFieldNo: 3, priority: 50 }),
            makeMapping({ sourceReference: 'RA000585', sourcePath: 'primary_name', targetFieldNo: 3, priority: 5 }),
        ]);

        const candidates = await RegistryMappingEngine.mapEnrichmentRun('run-001');
        expect(candidates).toHaveLength(1);
        expect(candidates[0].value).toBe('Winner Ltd');
    });

    // T4 ─ Returns empty array when no mappings exist
    it('T4: returns empty array when no mappings exist for RA, does not throw', async () => {
        const run = makeRun();
        prismaMock.enrichmentRun.findUnique.mockResolvedValue(run);
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

    // T7 ─ Field 5 (isMultiValue) mapping produces array candidate with correct provenance
    it('T7: Field 5 mapping produces array candidate with REGISTRATION_AUTHORITY source and correct RA sourceKey', async () => {
        const previousNames = [{ name: 'Former Name Plc', ceased_on: '2019-01-01', effective_from: '2010-01-01' }];

        const run = makeRun({
            registrationAuthorityId: 'RA000587',  // NI variant
            sourcePayloads: [makePayload('COMPANY_PROFILE', { previous_company_names: previousNames })],
        });

        prismaMock.enrichmentRun.findUnique.mockResolvedValue(run);
        // Field 5 is multi-value
        prismaMock.masterFieldDefinition.findUnique.mockResolvedValue({ isMultiValue: true });

        prismaMock.sourceFieldMapping.findMany.mockResolvedValue([
            makeMapping({
                sourceReference: 'RA000587',
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
        expect(c.sourceKey).toBe('RA000587');
    });

    // T8 ─ Returns empty when enrichmentRun not found
    it('T8: returns empty array and does not throw when EnrichmentRun is not found', async () => {
        prismaMock.enrichmentRun.findUnique.mockResolvedValue(null);

        const candidates = await RegistryMappingEngine.mapEnrichmentRun('nonexistent-run');
        expect(candidates).toEqual([]);
    });
});
