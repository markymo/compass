/**
 * backfill-field5-prod.js
 *
 * Backfills Field 5 (Previous Names) FieldClaims for all LEs that:
 *   1. Have a successful EnrichmentRun with a COMPANY_PROFILE payload
 *   2. Have `previous_company_names` in that payload
 *   3. Don't already have Field 5 FieldClaims (idempotent via KycWriteService)
 *
 * Usage:
 *   DRY RUN (no writes):  node scripts/backfill-field5-prod.js
 *   LIVE:                 node scripts/backfill-field5-prod.js --write
 *
 * Safety:
 *   - KycWriteService per-instanceId idempotency check prevents duplicate claims
 *   - Processes one LE at a time, logs every step
 *   - Hard limit of MAX_LES_TO_PROCESS prevents runaway
 */

const { PrismaClient } = require('@prisma/client');

const WRITE_MODE = process.argv.includes('--write');
const MAX_LES_TO_PROCESS = 200; // Hard cap

console.log('\n============================================================');
console.log('Field 5 Backfill Script');
console.log(`Mode: ${WRITE_MODE ? '🔴 LIVE WRITE' : '🟡 DRY RUN (pass --write to commit)'}`);
console.log('============================================================\n');

const p = new PrismaClient();

async function main() {
    // 1. Find all COMPANY_PROFILE payloads that have previous_company_names
    console.log('Step 1: Finding COMPANY_PROFILE payloads with previous_company_names...');

    const payloads = await p.registrySourcePayload.findMany({
        where: {
            payloadSubtype: 'COMPANY_PROFILE',
            isLatest: true,
        },
        select: {
            legalEntityId: true,
            enrichmentRunId: true,
            payload: true,
        },
        take: MAX_LES_TO_PROCESS * 2, // overfetch since many won't have previous names
    });

    // Filter to only those with previous_company_names
    const withPreviousNames = payloads.filter(p => {
        const data = p.payload;
        return Array.isArray(data?.previous_company_names) && data.previous_company_names.length > 0;
    });

    console.log(`Found ${payloads.length} COMPANY_PROFILE payloads total`);
    console.log(`Found ${withPreviousNames.length} with previous_company_names`);
    console.log(`Will process up to ${MAX_LES_TO_PROCESS}\n`);

    const toProcess = withPreviousNames.slice(0, MAX_LES_TO_PROCESS);

    // 2. For each, check if Field 5 claims already exist
    let alreadyDone = 0;
    let toWrite = [];

    for (const entry of toProcess) {
        // Resolve ClientLE → LegalEntity ID mapping
        const clientLE = await p.clientLE.findFirst({
            where: { legalEntityId: entry.legalEntityId },
            select: { id: true, legalEntityId: true }
        });

        if (!clientLE) {
            // legalEntityId in payload may be clientLEId (due to the bug we found)
            // Try treating it as a ClientLE id
            const byClientId = await p.clientLE.findUnique({
                where: { id: entry.legalEntityId },
                select: { id: true, legalEntityId: true }
            });
            if (!byClientId) {
                console.warn(`  SKIP: No ClientLE found for legalEntityId=${entry.legalEntityId}`);
                continue;
            }

            const resolvedLeId = byClientId.legalEntityId;
            const existingClaims = await p.fieldClaim.count({
                where: { subjectLeId: resolvedLeId, fieldNo: 5 }
            });

            const names = entry.payload.previous_company_names;
            console.log(`LE ${byClientId.id} (resolved: ${resolvedLeId})`);
            console.log(`  previous_company_names: ${names.length} entries`);
            console.log(`  existing Field 5 claims: ${existingClaims}`);

            if (existingClaims === 0) {
                toWrite.push({ clientLEId: byClientId.id, resolvedLeId, runId: entry.enrichmentRunId, names });
            } else {
                alreadyDone++;
                console.log(`  ✅ Already has claims, skipping`);
            }
            continue;
        }

        const resolvedLeId = clientLE.legalEntityId;
        const existingClaims = await p.fieldClaim.count({
            where: { subjectLeId: resolvedLeId, fieldNo: 5 }
        });

        const names = entry.payload.previous_company_names;
        console.log(`ClientLE ${clientLE.id} (resolved: ${resolvedLeId})`);
        console.log(`  previous_company_names: ${names.length} entries`);
        console.log(`  existing Field 5 claims: ${existingClaims}`);

        if (existingClaims === 0) {
            toWrite.push({ clientLEId: clientLE.id, resolvedLeId, runId: entry.enrichmentRunId, names });
        } else {
            alreadyDone++;
            console.log(`  ✅ Already has claims, skipping`);
        }
    }

    console.log(`\nSummary:`);
    console.log(`  Already have Field 5 claims: ${alreadyDone}`);
    console.log(`  Need backfilling: ${toWrite.length}`);

    if (!WRITE_MODE) {
        console.log('\n🟡 DRY RUN complete. No writes performed.');
        console.log('   Re-run with --write to commit claims.\n');
        p.$disconnect();
        return;
    }

    // 3. LIVE MODE: run RegistryMappingEngine + KycWriteService per LE
    // We do this via require() since this is a JS script calling TS compiled output.
    // Assumes the server has been built (next build) or tsx is available.
    console.log('\n🔴 LIVE MODE: writing claims...\n');

    // Dynamic import of compiled TS services
    const { RegistryMappingEngine } = require('../src/services/kyc/normalization/RegistryMappingEngine');
    const { KycWriteService } = require('../src/services/kyc/KycWriteService');
    const kycService = new KycWriteService();

    let written = 0;
    let failed = 0;

    for (const entry of toWrite) {
        console.log(`\nProcessing ClientLE ${entry.clientLEId}...`);
        console.log(`  Run ID: ${entry.runId}`);
        try {
            const candidates = await RegistryMappingEngine.mapEnrichmentRun(entry.runId);
            const field5 = candidates.filter(c => c.fieldNo === 5);

            if (field5.length === 0) {
                console.warn(`  ⚠️  Mapping engine produced no Field 5 candidates — check mapping config`);
                continue;
            }

            for (const candidate of field5) {
                const clean = { ...candidate, evidenceId: null };
                const ok = await kycService.applyFieldCandidate(entry.clientLEId, clean, undefined, 'CLIENT_LE');
                if (ok) {
                    console.log(`  ✅ Field 5 claims written (${Array.isArray(candidate.value) ? candidate.value.length : 1} rows)`);
                    written++;
                }
            }
        } catch (e) {
            console.error(`  ❌ Failed for ClientLE ${entry.clientLEId}:`, e.message);
            failed++;
        }
    }

    console.log('\n============================================================');
    console.log(`Backfill complete.`);
    console.log(`  Written: ${written}`);
    console.log(`  Failed:  ${failed}`);
    console.log('============================================================\n');

    p.$disconnect();
}

main().catch(e => {
    console.error('FATAL:', e);
    p.$disconnect();
    process.exit(1);
});
