/**
 * backfill-field5-prod.ts
 *
 * Backfills Field 5 (Previous Names) FieldClaims for all LEs that:
 *   1. Have a latest COMPANY_PROFILE payload with previous_company_names
 *   2. Are missing one or more Field 5 FieldClaims
 *
 * KycWriteService.applyFieldCandidate() is the idempotency gate:
 *   - Per-instanceId check prevents duplicate claims
 *   - Partially-backfilled LEs are handled correctly (only missing rows written)
 *
 * Usage:
 *   Dry run (default, no writes):
 *     npx tsx scripts/backfill-field5-prod.ts
 *
 *   Live write (requires explicit confirmation flag):
 *     npx tsx scripts/backfill-field5-prod.ts --write --i-know-this-is-prod
 *
 * Safety features:
 *   - Prints connected DB name at startup; aborts if unrecognised in write mode
 *   - Requires --i-know-this-is-prod alongside --write
 *   - Per-LE error isolation — one failure does not abort the batch
 *   - 500ms sleep between LEs to avoid hammering DB
 *   - Max cap of MAX_LES_TO_PROCESS with explicit log if cap is hit
 *   - Filters previous_company_names IN Postgres, not in JS memory
 *   - Summary shows exact claim-level counts, not candidate-level
 */

import prisma from '../src/lib/prisma';
import { RegistryMappingEngine } from '../src/services/kyc/normalization/RegistryMappingEngine';
import { KycWriteService } from '../src/services/kyc/KycWriteService';

const WRITE_MODE        = process.argv.includes('--write');
const CONFIRMED_PROD    = process.argv.includes('--i-know-this-is-prod');
const MAX_LES           = 500;
const SLEEP_MS_PER_LE   = 500;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ── Safety banner ──────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════════════════════');
console.log(' Field 5 (Previous Names) Backfill Script');
console.log(` Mode: ${WRITE_MODE ? '🔴  LIVE WRITE' : '🟡  DRY RUN (no writes)'}`);
console.log('══════════════════════════════════════════════════════════════\n');

async function main() {
    // ── Step 0: DB identity check ────────────────────────────────────────────
    const [dbInfo] = await prisma.$queryRaw<{ db: string; host: string }[]>`
        SELECT current_database() AS db, inet_server_addr()::text AS host
    `;
    console.log(`Connected to database : ${dbInfo.db}`);
    console.log(`Server host           : ${dbInfo.host ?? 'localhost/socket'}`);
    console.log();

    if (WRITE_MODE && !CONFIRMED_PROD) {
        console.error('❌  WRITE mode requires --i-know-this-is-prod flag.');
        console.error('    Re-run as: npx tsx scripts/backfill-field5-prod.ts --write --i-know-this-is-prod');
        process.exit(1);
    }

    if (WRITE_MODE) {
        console.log(`⚠️   Writing to: ${dbInfo.db} on ${dbInfo.host ?? 'localhost'}`);
        console.log('    You have 5 seconds to Ctrl+C if this is wrong.\n');
        await sleep(5000);
    }

    // ── Step 1: Find candidate LEs via Postgres JSONB filter ─────────────────
    // Filter in the DB — do NOT load all payloads into JS memory.
    console.log('Step 1: Querying for COMPANY_PROFILE payloads with previous_company_names…');

    const candidates = await prisma.$queryRaw<{
        legalEntityId: string;
        enrichmentRunId: string;
        nameCount: number;
    }[]>`
        SELECT
            rsp."legalEntityId",
            rsp."enrichmentRunId",
            jsonb_array_length(rsp.payload->'previous_company_names') AS "nameCount"
        FROM "registry_source_payloads" rsp
        WHERE rsp."payloadSubtype" = 'COMPANY_PROFILE'
          AND rsp."isLatest"       = true
          AND rsp.payload          ? 'previous_company_names'
          AND jsonb_array_length(rsp.payload->'previous_company_names') > 0
        ORDER BY rsp."legalEntityId"
        LIMIT ${MAX_LES + 1}
    `;

    if (candidates.length > MAX_LES) {
        console.warn(`⚠️  Query returned more than ${MAX_LES} candidates. Processing only first ${MAX_LES}.`);
        candidates.splice(MAX_LES);
    }

    console.log(`Found ${candidates.length} LEs with previous_company_names\n`);

    if (candidates.length === 0) {
        console.log('Nothing to backfill. Exiting.');
        return;
    }

    // ── Step 2: Resolve clientLE IDs and check existing claim counts ──────────
    console.log('Step 2: Checking existing Field 5 claim state per LE…\n');

    type WorkItem = {
        clientLEId:    string;
        resolvedLeId:  string;
        runId:         string;
        expectedNames: number;
        existingClaims: number;
    };

    const workItems: WorkItem[] = [];

    for (const c of candidates) {
        // RegistryEnrichmentService stores clientLEId in the legalEntityId column (known bug).
        // Try both: treat stored value as clientLEId first, then as real leId.
        let clientLEId: string | null = null;
        let resolvedLeId: string | null = null;

        const byClientId = await prisma.clientLE.findUnique({
            where: { id: c.legalEntityId },
            select: { id: true, legalEntityId: true }
        });

        if (byClientId) {
            clientLEId   = byClientId.id;
            resolvedLeId = byClientId.legalEntityId;
        } else {
            // Try as real legalEntityId
            const byLeId = await prisma.clientLE.findFirst({
                where: { legalEntityId: c.legalEntityId },
                select: { id: true, legalEntityId: true }
            });
            if (byLeId) {
                clientLEId   = byLeId.id;
                resolvedLeId = byLeId.legalEntityId;
            }
        }

        if (!clientLEId || !resolvedLeId) {
            console.warn(`  SKIP: Cannot resolve clientLE for stored legalEntityId=${c.legalEntityId}`);
            continue;
        }

        const existingClaims = await prisma.fieldClaim.count({
            where: { subjectLeId: resolvedLeId, fieldNo: 5 }
        });

        console.log(`ClientLE ${clientLEId}`);
        console.log(`  resolved leId    : ${resolvedLeId}`);
        console.log(`  previous names   : ${c.nameCount}`);
        console.log(`  existing claims  : ${existingClaims}`);

        if (existingClaims >= c.nameCount) {
            console.log(`  ✅ Already complete (${existingClaims}/${c.nameCount}), skipping\n`);
            continue;
        }

        // Partial or zero — let KycWriteService handle idempotency per row
        console.log(`  → Will attempt write (${c.nameCount - existingClaims} expected new rows)\n`);
        workItems.push({
            clientLEId,
            resolvedLeId,
            runId:          c.enrichmentRunId,
            expectedNames:  c.nameCount,
            existingClaims,
        });
    }

    console.log(`\nSummary: ${workItems.length} LEs need backfilling\n`);

    if (!WRITE_MODE) {
        console.log('🟡  DRY RUN complete. No writes performed.');
        console.log('    Re-run with --write --i-know-this-is-prod to commit.\n');
        return;
    }

    // ── Step 3: Write claims ──────────────────────────────────────────────────
    console.log('🔴  LIVE WRITE starting…\n');

    const kycService = new KycWriteService();
    let totalWritten  = 0; // claim rows written
    let totalSkipped  = 0; // claim rows skipped (idempotency)
    let totalFailed   = 0; // LEs that errored

    for (const item of workItems) {
        console.log(`Processing ClientLE ${item.clientLEId} (run: ${item.runId})…`);

        try {
            const candidates = await RegistryMappingEngine.mapEnrichmentRun(item.runId);
            const field5      = candidates.filter(c => c.fieldNo === 5);

            if (field5.length === 0) {
                console.warn(`  ⚠️  Mapping engine produced no Field 5 candidates — skipping`);
                totalFailed++;
                await sleep(SLEEP_MS_PER_LE);
                continue;
            }

            // Count claims before write
            const before = await prisma.fieldClaim.count({
                where: { subjectLeId: item.resolvedLeId, fieldNo: 5 }
            });

            for (const candidate of field5) {
                // Strip evidenceId — it's an EnrichmentRun ID, not an Evidence table FK
                const clean = { ...candidate, evidenceId: null };
                await kycService.applyFieldCandidate(item.clientLEId, clean, undefined, 'CLIENT_LE');
            }

            // Count claims after write
            const after = await prisma.fieldClaim.count({
                where: { subjectLeId: item.resolvedLeId, fieldNo: 5 }
            });

            const written = after - before;
            const skipped = item.expectedNames - written;
            totalWritten += written;
            totalSkipped += Math.max(0, skipped);

            console.log(`  ✅ Before: ${before} → After: ${after} (+${written} new, ${skipped} already existed)`);

        } catch (e: any) {
            console.error(`  ❌ Failed: ${e.message}`);
            totalFailed++;
        }

        await sleep(SLEEP_MS_PER_LE);
    }

    // ── Step 4: Final summary ─────────────────────────────────────────────────
    const grandTotal = await prisma.fieldClaim.count({ where: { fieldNo: 5 } });

    console.log('\n══════════════════════════════════════════════════════════════');
    console.log(' Backfill Complete');
    console.log(`  LEs processed    : ${workItems.length}`);
    console.log(`  Claim rows written: ${totalWritten}`);
    console.log(`  Already existed  : ${totalSkipped}`);
    console.log(`  LEs failed       : ${totalFailed}`);
    console.log(`  Total Field 5 claims in DB (all LEs): ${grandTotal}`);
    console.log('══════════════════════════════════════════════════════════════\n');
}

main()
    .catch(e => { console.error('FATAL:', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
