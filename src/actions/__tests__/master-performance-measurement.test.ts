import { describe, it, expect, vi, beforeEach } from 'vitest';

let activeSpans: Array<{ name: string; durationMs: number; attributes: Record<string, any> }> = [];

vi.mock('@sentry/nextjs', () => ({
    startSpan: async (context: any, callback: any) => {
        const attributes: Record<string, any> = {};
        const mockSpan = {
            setAttribute: (key: string, val: any) => {
                attributes[key] = val;
            }
        };
        const start = performance.now();
        const res = await callback(mockSpan);
        const end = performance.now();
        activeSpans.push({
            name: context.name,
            durationMs: end - start,
            attributes
        });
        return res;
    }
}));

vi.mock('next-auth', () => ({ default: vi.fn(() => ({ handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() })), getServerSession: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ notFound: vi.fn() }));
vi.mock('@/context/breadcrumb-context', () => ({ SetPageBreadcrumbs: () => null }));
vi.mock('@/components/client/kyc/enrichment-gate', () => ({ EnrichmentGate: ({ children }: any) => children }));
vi.mock('@/components/client/data-schema-tab', () => ({ DataSchemaTab: () => null }));
vi.mock('@/lib/auth', () => ({ getIdentity: vi.fn().mockResolvedValue({ userId: 'user_perf' }) }));
vi.mock('@/actions/security', () => ({ isSystemAdmin: vi.fn().mockResolvedValue(true), getUserFIOrg: vi.fn() }));

import prisma from '@/lib/prisma';
import MasterRecordPage from '@/app/(platform)/app/le/[id]/master/page';
import { invalidateDefinitionCache } from '@/services/masterData/definitionService';
import * as definitionService from '@/services/masterData/definitionService';

const mockMasterFields = Array.from({ length: 129 }, (_, i) => ({
    fieldNo: i + 1,
    fieldName: `Field ${i + 1}`,
    isMultiValue: i % 10 === 0,
    allowAttachments: i % 5 === 0,
    appDataType: 'TEXT',
    defaultResponse: i % 15 === 0 ? 'Default Value' : null,
    masterDataCategory: { id: `cat_${(i % 5) + 1}`, displayName: `Category ${(i % 5) + 1}`, order: i % 5 },
    optionSet: null
}));

const mockCategories = Array.from({ length: 5 }, (_, i) => ({
    id: `cat_${i + 1}`,
    key: `category_${i + 1}`,
    displayName: `Category ${i + 1}`,
    order: i + 1,
    fields: mockMasterFields.filter(f => f.masterDataCategory?.id === `cat_${i + 1}`)
}));

const mockClaims = Array.from({ length: 45 }, (_, i) => ({
    id: `claim_${i + 1}`,
    fieldNo: (i % 30) + 1,
    claimRole: 'VALUE',
    status: 'VERIFIED',
    assertedAt: new Date(),
    sourceType: 'GLEIF',
    sourceReference: null,
    value: { text: `Sample Value ${i + 1}`, ccPartyId: i === 0 ? 'party_1' : undefined },
    evidence: null
}));

const mockClientLE = {
    id: 'cle_perf_test',
    legalEntityId: 'le_perf_test',
    customData: { 'custom_field_uuid_1234567890': 'Value' },
    gleifFetchedAt: new Date(),
    registryReferences: [
        {
            id: 'reg_1',
            authority: { id: 'RA000585', name: 'Companies House' },
            localRegistrationNumber: '12345678',
            lastSyncSucceededAt: new Date(),
            lastSyncStatus: 'SUCCESS'
        }
    ]
};

vi.mock('@/lib/prisma', () => ({
    default: {
        clientLE: { findUnique: vi.fn(), findFirst: vi.fn() },
        clientLEOwner: { findFirst: vi.fn(), findMany: vi.fn() },
        fieldClaim: { findMany: vi.fn() },
        sourceFieldMapping: { findMany: vi.fn() },
        masterFieldDefinition: { findMany: vi.fn() },
        masterFieldGroup: { findMany: vi.fn() },
        masterDataCategory: { findMany: vi.fn() },
        customFieldDefinition: { findMany: vi.fn() },
        cCParty: { findMany: vi.fn() },
        cCAddress: { findMany: vi.fn() },
        membership: { findFirst: vi.fn(), findMany: vi.fn() },
        $queryRaw: vi.fn()
    }
}));

describe('Master Record Diagnostic Measurements', () => {
    let dbQueryCount = 0;

    beforeEach(() => {
        vi.restoreAllMocks();
        activeSpans = [];
        dbQueryCount = 0;

        const countQuery = (fn: Function) => (...args: any[]) => {
            dbQueryCount++;
            return fn(...args);
        };

        (prisma.clientLE.findUnique as any).mockImplementation(countQuery(async () => mockClientLE));
        (prisma.clientLE.findFirst as any).mockImplementation(countQuery(async () => mockClientLE));
        (prisma.clientLEOwner.findFirst as any).mockImplementation(countQuery(async () => ({ partyId: 'party_owner_1' })));
        (prisma.clientLEOwner.findMany as any).mockImplementation(countQuery(async () => []));
        (prisma.fieldClaim.findMany as any).mockImplementation(countQuery(async () => mockClaims));
        (prisma.sourceFieldMapping.findMany as any).mockImplementation(countQuery(async () => [
            { targetFieldNo: 1, sourceType: 'GLEIF', sourceReference: null, priority: 1 }
        ]));
        (prisma.masterFieldDefinition.findMany as any).mockImplementation(countQuery(async () => mockMasterFields));
        (prisma.masterFieldGroup.findMany as any).mockImplementation(countQuery(async () => []));
        (prisma.masterDataCategory.findMany as any).mockImplementation(countQuery(async () => mockCategories));
        (prisma.customFieldDefinition.findMany as any).mockImplementation(countQuery(async () => [
            { id: 'custom_field_uuid_1234567890', label: 'Custom Field 1' }
        ]));
        (prisma.cCParty.findMany as any).mockImplementation(countQuery(async () => [{ id: 'party_1', data: { name: 'Acme Corp' } }]));
        (prisma.cCAddress.findMany as any).mockImplementation(countQuery(async () => []));
        (prisma.membership.findFirst as any).mockImplementation(countQuery(async () => ({ id: 'mem_1' })));
        (prisma.membership.findMany as any).mockImplementation(countQuery(async () => []));
        (prisma.$queryRaw as any).mockImplementation(countQuery(async () => []));

        vi.spyOn(definitionService, 'listAllMasterFields').mockResolvedValue(mockMasterFields as any);
    });

    it('collects diagnostic metrics for cold load and 5 warm loads', async () => {
        // Cold Load
        invalidateDefinitionCache();
        dbQueryCount = 0;
        const coldStart = performance.now();
        await MasterRecordPage({ params: Promise.resolve({ id: 'cle_perf_test' }) });
        const coldEnd = performance.now();
        const coldDuration = coldEnd - coldStart;
        const coldDbQueries = dbQueryCount;

        // 5 Warm Runs
        const warmResults: Array<{
            totalMs: number;
            dbQueries: number;
            spans: Record<string, { durationMs: number; attributes: Record<string, any> }>;
        }> = [];

        for (let i = 0; i < 5; i++) {
            activeSpans = [];
            dbQueryCount = 0;
            const start = performance.now();
            await MasterRecordPage({ params: Promise.resolve({ id: 'cle_perf_test' }) });
            const end = performance.now();

            const spanMap: Record<string, { durationMs: number; attributes: Record<string, any> }> = {};
            activeSpans.forEach(s => {
                spanMap[s.name] = { durationMs: s.durationMs, attributes: s.attributes };
            });

            warmResults.push({
                totalMs: end - start,
                dbQueries: dbQueryCount,
                spans: spanMap
            });
        }

        const sortedWarm = [...warmResults].sort((a, b) => a.totalMs - b.totalMs);
        const medianWarm = sortedWarm[2];

        console.log('\n======================================================');
        console.log('         DIAGNOSTIC MEASUREMENT RESULTS TABLE         ');
        console.log('======================================================');
        console.log(`Cold Load Total Duration: ${coldDuration.toFixed(2)} ms | DB Queries: ${coldDbQueries}`);
        console.log('Warm Loads Total Durations: ' + warmResults.map(r => `${r.totalMs.toFixed(2)} ms`).join(', '));
        console.log(`Median Warm Duration: ${medianWarm.totalMs.toFixed(2)} ms (Range: ${sortedWarm[0].totalMs.toFixed(2)} ms - ${sortedWarm[4].totalMs.toFixed(2)} ms)`);
        console.log(`Actual Prisma Client DB Operations per Warm Load: ${medianWarm.dbQueries}`);
        console.log('\n--- MEDIAN WARM SPAN BREAKDOWN & ATTRIBUTES ---');

        Object.entries(medianWarm.spans).forEach(([name, data]) => {
            console.log(`Span [${name.padEnd(32)}]: ${data.durationMs.toFixed(2)} ms`);
            if (Object.keys(data.attributes).length > 0) {
                console.log(`    Attributes:`, JSON.stringify(data.attributes));
            }
        });

        console.log('======================================================\n');

        expect(warmResults.length).toBe(5);
        expect(medianWarm.spans['master.total']).toBeDefined();
        expect(medianWarm.spans['master.getFullMasterData']).toBeDefined();
        expect(medianWarm.spans['master.getCategoriesWithFields']).toBeDefined();
        expect(medianWarm.spans['master.deepClone.total']).toBeDefined();
    });
});
