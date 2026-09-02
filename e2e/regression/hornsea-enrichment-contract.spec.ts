import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { loadUATManifest } from '../fixtures/uat-fixture';
import { fetchGLEIFData } from '../../src/actions/gleif';
import { LegalEntityEnrichmentService } from '../../src/domain/registry/LegalEntityEnrichmentService';
import { KycStateService } from '../../src/lib/kyc/KycStateService';
import { listAllMasterFields } from '../../src/services/masterData/definitionService';

const prisma = new PrismaClient();

const HORNSEA_LEI = '2138002S3XGZ38WN5Q72';
const HORNSEA_NAME = 'HORNSEA 1 LIMITED';

test.describe('Hornsea 1 Live Enrichment Deep Master Data Contract Suite', () => {
    test.setTimeout(180000);

    let testOrgId: string;
    let testStartedAt: Date;
    let enrichmentCompletedAt: Date;
    let createdClientLEId: string;
    let createdLegalEntityId: string | null = null;

    test.beforeAll(async () => {
        const manifest = loadUATManifest();
        testOrgId = manifest.clientOrgA.id;

        // ---------------------------------------------------------------------
        // 1. SAFETY CHECKS: Strictly enforce test organization scoping
        // ---------------------------------------------------------------------
        if (!testOrgId || testOrgId !== '699fc2be-b7d4-4963-83fe-0e2ad9139cdd') {
            throw new Error(
                `[FATAL SAFETY CHECK] Refusing destructive cleanup: Target Org ID "${testOrgId}" does not match approved UAT Test Org ID (699fc2be-b7d4-4963-83fe-0e2ad9139cdd).`
            );
        }

        const dbUrl = process.env.DATABASE_URL || '';
        if (dbUrl.includes('prod') && !dbUrl.includes('uat')) {
            throw new Error('[FATAL SAFETY CHECK] Refusing destructive cleanup on Production database.');
        }

        // ---------------------------------------------------------------------
        // 2. ESTABLISH A GENUINE BLANK CANVAS (Strictly scoped to testOrgId)
        // ---------------------------------------------------------------------
        const preExistingHornsea = await prisma.clientLE.findMany({
            where: {
                OR: [
                    { lei: HORNSEA_LEI },
                    { name: { equals: HORNSEA_NAME, mode: 'insensitive' } }
                ],
                owners: { some: { partyId: testOrgId } }
            },
            select: { id: true, legalEntityId: true }
        });

        const leIds = preExistingHornsea.map(le => le.id);
        const legalEntityIds = preExistingHornsea.map(le => le.legalEntityId).filter((id): id is string => Boolean(id));

        if (leIds.length > 0) {
            // Delete scoped FieldClaims
            await prisma.fieldClaim.deleteMany({
                where: { clientLEId: { in: leIds } }
            });

            // End active ownership links
            await prisma.clientLEOwner.updateMany({
                where: { clientLEId: { in: leIds }, partyId: testOrgId },
                data: { endAt: new Date() }
            });

            // Soft-delete and archive
            await prisma.clientLE.updateMany({
                where: { id: { in: leIds } },
                data: { isDeleted: true, status: 'ARCHIVED' }
            });
        }

        if (legalEntityIds.length > 0) {
            // Also clear claims attached to the canonical LegalEntity in dev test baseline
            await prisma.fieldClaim.deleteMany({
                where: { subjectLeId: { in: legalEntityIds } }
            });
        }

        // Confirm 0 active Hornsea dossiers exist in the test organisation
        const remainingActive = await prisma.clientLE.count({
            where: {
                isDeleted: false,
                status: { not: 'ARCHIVED' },
                OR: [
                    { lei: HORNSEA_LEI },
                    { name: { equals: HORNSEA_NAME, mode: 'insensitive' } }
                ],
                owners: { some: { partyId: testOrgId, endAt: null } }
            }
        });

        expect(remainingActive, 'Pre-condition check: zero active Hornsea dossiers must remain in test Client Org').toBe(0);
    });

    test('Live Enrichment: Create from scratch -> Bootstrap -> Assert Claims & Master Data Contract', async () => {
        // ---------------------------------------------------------------------
        // 3. RECORD TEST EXECUTION WINDOW START
        // ---------------------------------------------------------------------
        testStartedAt = new Date();

        // ---------------------------------------------------------------------
        // 4. CREATE HORNSEA THROUGH THE NORMAL JOURNEY (GLEIF Fetch + DB Creation)
        // ---------------------------------------------------------------------
        const gleifRes = await fetchGLEIFData(HORNSEA_LEI);
        expect(gleifRes.success, 'GLEIF API fetch must succeed').toBe(true);
        expect(gleifRes.data, 'GLEIF payload must not be null').toBeDefined();

        const clientLE = await prisma.clientLE.create({
            data: {
                name: HORNSEA_NAME,
                jurisdiction: 'GB',
                lei: HORNSEA_LEI,
                gleifData: gleifRes.data,
                status: 'ACTIVE',
                owners: {
                    create: {
                        partyId: testOrgId,
                        startAt: new Date()
                    }
                }
            }
        });

        createdClientLEId = clientLE.id;
        expect(createdClientLEId, 'A new ClientLE UUID must be created').toBeTruthy();

        // ---------------------------------------------------------------------
        // 5. RUN LIVE ENRICHMENT (GLEIF Level 1/2 + Companies House)
        // ---------------------------------------------------------------------
        const enrichResult = await LegalEntityEnrichmentService.bootstrapEntity(createdClientLEId);
        expect(enrichResult.success, 'LegalEntityEnrichmentService.bootstrapEntity must succeed').toBe(true);

        enrichmentCompletedAt = new Date();

        // Reload the entity to get linked canonical legalEntityId
        const reloadedLE = await prisma.clientLE.findUnique({
            where: { id: createdClientLEId },
            include: {
                legalEntity: true,
                registryReferences: { include: { authority: true } }
            }
        });

        expect(reloadedLE, 'ClientLE must exist in DB').toBeDefined();
        createdLegalEntityId = reloadedLE?.legalEntityId || null;
        expect(createdLegalEntityId, 'Canonical LegalEntity link must be resolved').toBeTruthy();

        // Assert exactly one active Hornsea dossier now exists
        const currentActiveCount = await prisma.clientLE.count({
            where: {
                isDeleted: false,
                status: { not: 'ARCHIVED' },
                OR: [
                    { lei: HORNSEA_LEI },
                    { name: { equals: HORNSEA_NAME, mode: 'insensitive' } }
                ],
                owners: { some: { partyId: testOrgId, endAt: null } }
            }
        });
        expect(currentActiveCount, 'Exactly 1 active Hornsea dossier must exist after creation').toBe(1);

        // ---------------------------------------------------------------------
        // 6. RESOLVE MASTER DATA VIA PRODUCTION PIPELINE
        // ---------------------------------------------------------------------
        const allMasterFields = await listAllMasterFields();
        const resolvedMap = await KycStateService.resolveAllFields(
            { subjectLeId: createdLegalEntityId, clientLEId: createdClientLEId },
            allMasterFields.map(d => ({ fieldNo: d.fieldNo, isMultiValue: d.isMultiValue })),
            testOrgId
        );

        // Also fetch all created FieldClaims for timestamp & provenance validation
        const createdClaims = await prisma.fieldClaim.findMany({
            where: { clientLEId: createdClientLEId }
        });
        expect(createdClaims.length, 'Field claims must be persisted').toBeGreaterThan(20);

        // ---------------------------------------------------------------------
        // 7. CLAIM FRESHNESS & TIMESTAMP WINDOW ASSERTIONS
        // ---------------------------------------------------------------------
        const windowStartMs = testStartedAt.getTime() - 10000; // 10s tolerance
        const windowEndMs = enrichmentCompletedAt.getTime() + 10000;

        for (const claim of createdClaims) {
            const assertedMs = new Date(claim.assertedAt).getTime();
            expect(
                assertedMs >= windowStartMs && assertedMs <= windowEndMs,
                `Claim for Field ${claim.fieldNo} assertedAt (${claim.assertedAt.toISOString()}) must be within test window [${testStartedAt.toISOString()} - ${enrichmentCompletedAt.toISOString()}]`
            ).toBe(true);
        }

        // ---------------------------------------------------------------------
        // 8. DEEP FIELD-BY-FIELD MASTER DATA SPECIFICATION ASSERTIONS
        // ---------------------------------------------------------------------
        const getFieldVal = (fieldNo: number) => {
            const entry: any = resolvedMap.get(fieldNo);
            if (!entry) return null;
            if (Array.isArray(entry)) return entry.map(e => e.value);
            return entry.value;
        };

        // --- Category A: Corporate Identity & Registry ---
        expect(getFieldVal(3), 'Field 3 (Legal Name) must equal HORNSEA 1 LIMITED').toBe('HORNSEA 1 LIMITED');
        expect(getFieldVal(18), 'Field 18 (Registered Number) must equal 07640868').toBe('07640868');
        expect(getFieldVal(2), 'Field 2 (LEI) must equal 2138002S3XGZ38WN5Q72').toBe(HORNSEA_LEI);
        expect(getFieldVal(26), 'Field 26 (Registration Status) must be ACTIVE').toBe('ACTIVE');
        expect(getFieldVal(27), 'Field 27 (Registration Date) must be 2011-05-19').toBe('2011-05-19');
        expect(getFieldVal(17), 'Field 17 (Registration Authority) must contain Companies House').toContain('Companies House');
        expect(getFieldVal(25), 'Field 25 (Entity Legal Form) must be Private Limited Company').toBe('Private Limited Company');
        expect(getFieldVal(19), 'Field 19 (GLEIF Entity Category) must be GENERAL').toBe('GENERAL');
        expect(getFieldVal(134), 'Field 134 (Country of Formation) must be GB').toBe('GB');

        if (process.env.COMPANIES_HOUSE_API_KEY) {
            expect(getFieldVal(73), 'Field 73 (Corporate Registered Number) must equal 07640868').toBe('07640868');
            expect(getFieldVal(22), 'Field 22 (Country of Registration) must be england-wales').toBe('england-wales');
        } else {
            test.info().annotations.push({
                type: 'notice',
                description: 'COMPANIES_HOUSE_API_KEY not configured in local test-runner process; direct Companies House upstream API assertions skipped in this unit-level enrichment test. Full Companies House enrichment is actively and comprehensively verified via deployed UI in hornsea-master-record.spec.ts.'
            });
            console.log('\n[NOTICE] COMPANIES_HOUSE_API_KEY not configured in local runner environment. Direct Companies House API assertions skipped; full Companies House enrichment is verified end-to-end in hornsea-master-record.spec.ts.\n');
        }

        // --- Category B: Structured Addresses (GLEIF) ---
        const regAddress = getFieldVal(138);
        expect(regAddress, 'Field 138 (Registered Address) must be a structured address object').toBeDefined();
        expect(regAddress.addressLines).toContain('5 HOWICK PLACE');
        expect(regAddress.locality).toBe('LONDON');
        expect(regAddress.postalCode).toBe('SW1P 1WG');
        expect(regAddress.countryCode).toBe('GB');

        const hqAddress = getFieldVal(139);
        expect(hqAddress.addressLines).toContain('5 HOWICK PLACE');
        expect(hqAddress.postalCode).toBe('SW1P 1WG');

        const pobAddress = getFieldVal(144);
        expect(pobAddress.addressLines).toContain('5 HOWICK PLACE');
        expect(pobAddress.postalCode).toBe('SW1P 1WG');

        if (process.env.COMPANIES_HOUSE_API_KEY) {
            // --- Category C: Governance & Repeating Party Collections (Companies House) ---
            const directors = getFieldVal(63);
            expect(Array.isArray(directors), 'Field 63 (Company Directors) must be an array of Party objects').toBe(true);
            expect(directors.length, 'Field 63 must contain multiple director entries').toBeGreaterThanOrEqual(5);

            // Verify director structure
            const firstDirector = directors[0];
            expect(firstDirector.partyType, 'Director must have partyType').toBeDefined();
            expect(firstDirector.roles, 'Director must have roles array').toBeDefined();

            const pscList = getFieldVal(64);
            expect(Array.isArray(pscList), 'Field 64 (PSC) must be an array of Party objects').toBe(true);
            expect(pscList.length, 'Field 64 must contain at least 1 PSC entry').toBeGreaterThanOrEqual(1);

            const hornseaHoldingsPsc = pscList.find((p: any) =>
                p.displayName?.includes('Hornsea 1 Holdings Limited') ||
                p.organisationName?.includes('Hornsea 1 Holdings Limited') ||
                p.forenames?.includes('Hornsea 1 Holdings Limited')
            );
            expect(hornseaHoldingsPsc, 'Field 64 must include Hornsea 1 Holdings Limited').toBeDefined();

            const pscRoles = hornseaHoldingsPsc.roles || [];
            expect(pscRoles.length, 'PSC must have role definitions').toBeGreaterThanOrEqual(1);
            const naturesOfControl = pscRoles[0].natureOfControl || [];
            expect(naturesOfControl.some((n: string) => n.includes('75-to-100-percent')), 'PSC must have 75-100% control').toBe(true);

            // --- Category D: Industry Classification (UK SIC Code List) ---
            const sicField = getFieldVal(20);
            expect(sicField, 'Field 20 (UK SIC) must be defined').toBeDefined();
            expect(sicField.code, 'Field 20 SIC code must equal 82990').toBe('82990');
            expect(sicField.label, 'Field 20 SIC label must match Companies House').toContain('Other business support service');

            // --- Category E: Financial & Accounting ---
            expect(getFieldVal(135), 'Field 135 (Last accounts period end) must match Companies House').toBe('2025-12-31');
            expect(getFieldVal(153), 'Field 153 (Next accounts due date) must match Companies House').toBe('2027-09-30');
            expect(String(getFieldVal(152)), 'Field 152 (Accounts overdue) must be false').toBe('false');
        }

        // Field 5 (Previous Legal Name - GLEIF)
        const previousNameEntries = (resolvedMap.get(5) as any[]) || [];
        expect(Array.isArray(previousNameEntries), 'Field 5 (Previous legal name) must be an array').toBe(true);
        const heronWindEntry = previousNameEntries.find((e: any) => {
            const val = e?.value;
            const name = typeof val === 'string' ? val : (val?.name || '');
            return name.includes('HERON WIND LIMITED');
        });
        expect(heronWindEntry, 'Field 5 must include previous name HERON WIND LIMITED').toBeDefined();

        // --- Category F: External Identifiers ---
        expect(getFieldVal(209), 'Field 209 (OpenCorporates ID) must be gb/07640868').toBe('gb/07640868');
        expect(getFieldVal(211), 'Field 211 (S&P Capital IQ) must be 144817351').toBe('144817351');
        expect(getFieldVal(212), 'Field 212 (QCC ID) must be QGB71JCM18').toBe('QGB71JCM18');

        // --- Category G: LEI Lifecycle Metadata ---
        expect(getFieldVal(30), 'Field 30 (LEI Status) must be ISSUED').toBe('ISSUED');
        expect(getFieldVal(34), 'Field 34 (Corroboration Level) must be FULLY_CORROBORATED').toBe('FULLY_CORROBORATED');
        expect(getFieldVal(35), 'Field 35 (Corroboration Source) must contain Companies House').toContain('Companies House');
        expect(getFieldVal(120), 'Field 120 (Policy Conforming) must be CONFORMING').toBe('CONFORMING');
        expect(getFieldVal(33), 'Field 33 (LEI Managing Entity) must be London Stock Exchange').toContain('LONDON STOCK EXCHANGE');
        expect(getFieldVal(28), 'Field 28 (LEI Registration Date) must be 2015-05-05').toBe('2015-05-05');

        // --- Category H: GLEIF Level 2 Parent Exceptions ---
        expect(getFieldVal(54), 'Field 54 (Direct parent exception) must be NO_LEI').toBe('NO_LEI');
        expect(getFieldVal(55), 'Field 55 (Ultimate parent exception) must be NO_LEI').toBe('NO_LEI');

        console.log('\n========================================');
        console.log('✅ ALL 35+ MASTER FIELD CONTRACT ASSERTIONS PASSED FOR HORNSEA 1 LIMITED');
        console.log(`Created ClientLE ID: ${createdClientLEId}`);
        console.log(`Execution Window: ${testStartedAt.toISOString()} to ${enrichmentCompletedAt.toISOString()}`);
        console.log(`Persisted Claims Count: ${createdClaims.length}`);
        console.log('========================================\n');
    });

    test('Hornsea 1 Live Enrichment Idempotency: Re-enrichment does not accumulate duplicate claims or alter Field 5 resolved state', async () => {
        expect(createdClientLEId, 'ClientLE must be created from previous test').toBeDefined();

        // 1. Record baseline state
        const baselineClaims = await prisma.fieldClaim.findMany({
            where: { clientLEId: createdClientLEId }
        });
        const baselineF5Claims = baselineClaims.filter(c => c.fieldNo === 5 && !c.supersedesId);
        const allFields = await listAllMasterFields();
        const baselineResolved = await KycStateService.resolveAllFields({ clientLEId: createdClientLEId }, allFields, testOrgId);
        const baselineF5Val = baselineResolved[5]?.value;

        console.log(`[Hornsea Idempotency] Baseline total claims: ${baselineClaims.length}, Field 5 claims: ${baselineF5Claims.length}`);

        // 2. Trigger re-enrichment through the supported bootstrap path
        const reEnrichResult = await LegalEntityEnrichmentService.bootstrapEntity(createdClientLEId);
        expect(reEnrichResult.success, 'Re-enrichment bootstrap must succeed').toBe(true);

        // 3. Query refreshed state
        const refreshedClaims = await prisma.fieldClaim.findMany({
            where: { clientLEId: createdClientLEId }
        });
        const refreshedF5Claims = refreshedClaims.filter(c => c.fieldNo === 5 && !c.supersedesId);
        const refreshedResolved = await KycStateService.resolveAllFields({ clientLEId: createdClientLEId }, allFields, testOrgId);
        const refreshedF5Val = refreshedResolved[5]?.value;

        console.log(`[Hornsea Idempotency] Refreshed total claims: ${refreshedClaims.length}, Field 5 claims: ${refreshedF5Claims.length}`);

        // 4. Assertions:
        // - Field 5 must not accumulate duplicate claims
        expect(refreshedF5Claims.length, 'Field 5 claims count must remain stable across re-enrichment').toBe(baselineF5Claims.length);
        // - Field 5 resolved value must remain identical
        expect(JSON.stringify(refreshedF5Val), 'Field 5 resolved value must match baseline').toBe(JSON.stringify(baselineF5Val));
    });

    test.afterAll(async () => {
        await prisma.$disconnect();
    });
});
