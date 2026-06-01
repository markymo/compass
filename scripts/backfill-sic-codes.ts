/**
 * backfill-sic-codes.ts
 *
 * One-shot backfill: replays RegistryMappingEngine against existing enrichment
 * runs to materialise field 20 (Industry classification) SIC code claims.
 *
 * Safe to run multiple times — KycWriteService idempotency prevents duplicates.
 *
 * Usage:
 *   npx tsx scripts/backfill-sic-codes.ts
 */

import { RegistryMappingEngine } from '../src/services/kyc/normalization/RegistryMappingEngine';
import { KycWriteService } from '../src/services/kyc/KycWriteService';
import prisma from '../src/lib/prisma';

const RUN_IDS = [
    '1b45a687-b7be-4618-b4d0-391c675a5910', // Diamond Transmission (35120)
    '668f9eda-4cf4-4888-a9f2-133f106a22f4', // LYNN WIND FARM (35110)
    '8c40d113-d6d6-4754-9311-a83743b3f142', // RWE Renewables (43120)
];

async function main() {
    const writeService = new KycWriteService();

    for (const runId of RUN_IDS) {
        console.log(`\n── Processing run ${runId} ──`);

        // enrichment_runs.legalEntityId is the ClientLE.id — resolve to the
        // underlying LegalEntity.id that FieldClaim.subjectLeId requires.
        const run = await prisma.enrichmentRun.findUnique({
            where: { id: runId },
            select: { legalEntityId: true }  // this is ClientLE.id
        });
        if (!run) { console.error('  Run not found — skipping.'); continue; }

        const cle = await prisma.clientLE.findUnique({
            where: { id: run.legalEntityId },
            select: { id: true, legalEntityId: true }
        });
        if (!cle?.legalEntityId) {
            console.error(`  Cannot resolve ClientLE ${run.legalEntityId} → LegalEntity — skipping.`);
            continue;
        }
        console.log(`  ClientLE ${cle.id} → LegalEntity ${cle.legalEntityId}`);

        const candidates = await RegistryMappingEngine.mapEnrichmentRun(runId);
        const sicCandidates = candidates.filter(c => c.fieldNo === 20);

        if (sicCandidates.length === 0) {
            console.log('  No field-20 candidates produced.');
            continue;
        }

        for (const candidate of sicCandidates) {
            if (Array.isArray(candidate.value)) {
                candidate.value.forEach((item: any, i: number) =>
                    console.log(`  [${i}] code=${item.code}  label=${item.label ?? '(null)'}  rowKey=${candidate.rowKeys?.[i]}`)
                );
            }

            const ok = await writeService.applyFieldCandidate(cle.legalEntityId, {
                ...candidate,
                evidenceId: undefined, // EnrichmentRun.id ≠ valid RegistryFetch FK
            });
            console.log(`  applyFieldCandidate → ${ok ? '✓ OK' : '✗ FAILED'}`);
        }
    }

    console.log('\n✓ Backfill complete.');
    process.exit(0);
}

main().catch(err => {
    console.error('Backfill failed:', err);
    process.exit(1);
});
