/**
 * test-field5-mapping.ts
 * 
 * Run: npx ts-node --project tsconfig.json -e "$(cat scripts/test-field5-mapping.ts)"
 * Or:  npx tsx scripts/test-field5-mapping.ts
 * 
 * Directly invokes the RegistryMappingEngine against the latest enrichment run
 * for the Centrica test LE to verify Field 5 previous_company_names mapping.
 */

import { RegistryMappingEngine } from '../src/services/kyc/normalization/RegistryMappingEngine';
import { KycWriteService } from '../src/services/kyc/KycWriteService';
import prisma from '../src/lib/prisma';

// Dev LE: RWE Renewables / Dogger Bank South Two
const LE_ID  = '683a79f9-4933-46d3-a6c4-0e2fe934db23'; // ClientLE ID
const RUN_ID = '8c40d113-d6d6-4754-9311-a83743b3f142'; // Most recent EnrichmentRun


async function main() {
    console.log('\n=== Step 1: Run Mapping Engine ===');
    const candidates = await RegistryMappingEngine.mapEnrichmentRun(RUN_ID);
    
    const field5 = candidates.filter(c => c.fieldNo === 5);
    console.log(`\nTotal candidates: ${candidates.length}`);
    console.log(`Field 5 candidates: ${field5.length}`);
    
    if (field5.length > 0) {
        console.log('\nField 5 candidate:');
        const c = field5[0];
        console.log('  value type:', Array.isArray(c.value) ? `array[${c.value.length}]` : typeof c.value);
        if (Array.isArray(c.value)) {
            c.value.forEach((item: any, i: number) => {
                console.log(`  [${i}]`, JSON.stringify(item));
            });
        }
        console.log('  rowKeys:', c.rowKeys);
    } else {
        console.log('\n⚠️  No Field 5 candidates produced. Check logs above for skip reasons.');
        process.exit(0);
    }

    console.log('\n=== Step 2: Apply Candidates to DB ===');
    const kycService = new KycWriteService();

    for (const candidate of field5) {
        // Strip evidenceId — it's an EnrichmentRun ID, not an Evidence table FK.
        // The production LegalEntityEnrichmentService.refreshRegistryClaims does the same.
        const cleanCandidate = { ...candidate, evidenceId: null };
        try {
            await kycService.applyFieldCandidate(LE_ID, cleanCandidate, undefined, 'CLIENT_LE');
            console.log('✅ Applied Field 5 candidate');
        } catch (e: any) {
            console.error('❌ applyFieldCandidate failed:', e.message);
        }
    }

    console.log('\n=== Step 3: Verify FieldClaims ===');
    // KycWriteService resolves CLIENT_LE → LegalEntity before writing,
    // so claims are stored against the resolved legalEntityId (subjectLeId).
    const clientLE = await prisma.clientLE.findUnique({
        where: { id: LE_ID },
        select: { legalEntityId: true }
    });
    const resolvedLeId = clientLE?.legalEntityId;
    console.log('Resolved legalEntityId:', resolvedLeId);

    const claims = await prisma.fieldClaim.findMany({
        where: { subjectLeId: resolvedLeId, fieldNo: 5 },
        select: {
            id: true,
            instanceId: true,
            collectionId: true,
            valueText: true,
            valueJson: true,
            effectiveFrom: true,
            effectiveTo: true,
            sourceType: true,
        },
        orderBy: { assertedAt: 'desc' }
    });

    console.log(`\nField 5 FieldClaims in DB: ${claims.length}`);
    claims.forEach((c, i) => {
        console.log(`  [${i}] instanceId=${c.instanceId}`);
        console.log(`       collectionId=${c.collectionId}`);
        console.log(`       valueJson=${JSON.stringify(c.valueJson)}`);
        console.log(`       effectiveFrom=${c.effectiveFrom} → effectiveTo=${c.effectiveTo}`);
        console.log(`       valueText=${c.valueText}`);
    });
}

main()
    .catch(e => { console.error('FATAL:', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
