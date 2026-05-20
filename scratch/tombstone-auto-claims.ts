#!/usr/bin/env ts-node
/**
 * tombstone-auto-claims.ts
 *
 * Surgical cleanup script for pre-rowKey Field 63 (Current Directors) claims.
 *
 * DEFAULTS TO DRY RUN. Pass --execute to write tombstones.
 *
 * Targets ONLY:
 *   fieldNo         = 63
 *   subjectLeId     = 3f3b592b-20e3-46c8-9eb1-9af01958f99f  (LYNN WIND FARM LIMITED)
 *   instanceId      LIKE 'auto_%'
 *   sourceType      = REGISTRATION_AUTHORITY
 *   status          NOT IN (REJECTED)
 *   valueJson       NOT { tombstone: true }   (skip existing tombstones)
 *   instanceId      NOT LIKE 'row_%'          (skip USER_INPUT row_* entries)
 *   instanceId      NOT LIKE 'ch_%'           (skip any future deterministic rows)
 *
 * Run:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' -r tsconfig-paths/register scratch/tombstone-auto-claims.ts
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' -r tsconfig-paths/register scratch/tombstone-auto-claims.ts --execute
 *
 * Safety guardrails:
 *   - Aborts if matched claims span more than one LE
 *   - Aborts if matched claims span more than one fieldNo
 *   - Aborts if more than 50 claims are targeted (unexpected scope)
 *   - Never hard-deletes. Tombstones only.
 *   - Prints full report before any writes
 *   - Idempotent: already-tombstoned slots are detected and skipped
 */

import { PrismaClient, SourceType, ClaimStatus } from '@prisma/client';
import { FieldClaimService } from '../src/lib/kyc/FieldClaimService';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG — change nothing below unless you know what you're doing
// ─────────────────────────────────────────────────────────────────────────────

const TARGET_CLIENT_LE_ID = '3f3b592b-20e3-46c8-9eb1-9af01958f99f';
const TARGET_FIELD_NO     = 63;
const MAX_SAFE_TARGET_COUNT = 50;      // Abort if more than this are matched
const TOMBSTONE_SOURCE    = SourceType.SYSTEM_DERIVED;  // Not user, not RA — explicitly system

// ─────────────────────────────────────────────────────────────────────────────

const prisma = new PrismaClient();
const IS_EXECUTE = process.argv.includes('--execute');

function box(label: string, char = '═') {
    const line = char.repeat(70);
    console.log(`\n${line}`);
    console.log(`  ${label}`);
    console.log(line);
}

function warn(msg: string) {
    console.log(`\n  ⚠️   ${msg}`);
}

function ok(msg: string) {
    console.log(`  ✅  ${msg}`);
}

function fail(msg: string) {
    console.log(`\n  ❌  ${msg}`);
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {

    // ── 0. Mode banner ───────────────────────────────────────────────────────
    box(IS_EXECUTE
        ? '⚠️  EXECUTE MODE — TOMBSTONES WILL BE WRITTEN TO THE DATABASE'
        : '🔍  DRY RUN MODE — No DB writes. Pass --execute to run for real.'
    );

    // ── 1. Resolve subject ───────────────────────────────────────────────────
    box('1. TARGET RESOLUTION');

    const clientLE = await prisma.clientLE.findUnique({
        where: { id: TARGET_CLIENT_LE_ID },
        select: { id: true, name: true, legalEntityId: true }
    });

    if (!clientLE?.legalEntityId) {
        fail(`ClientLE not found or has no legalEntityId: ${TARGET_CLIENT_LE_ID}`);
        process.exit(1);
    }

    const subjectLeId = clientLE.legalEntityId;

    console.log(`\n  ClientLE ID   : ${clientLE.id}`);
    console.log(`  Name          : ${clientLE.name}`);
    console.log(`  LegalEntity ID: ${subjectLeId}`);
    console.log(`  Field No      : ${TARGET_FIELD_NO}`);

    // ── 2. Fetch candidate rows ───────────────────────────────────────────────
    box('2. CANDIDATE CLAIMS');

    const allF63Claims = await prisma.fieldClaim.findMany({
        where: { fieldNo: TARGET_FIELD_NO, subjectLeId },
        include: {
            valuePerson: { select: { firstName: true, lastName: true } }
        },
        orderBy: [{ instanceId: 'asc' }, { assertedAt: 'desc' }]
    });

    console.log(`\n  Total F63 claims for this LE: ${allF63Claims.length}`);

    // ── 3. Safety checks on full set ─────────────────────────────────────────
    box('3. SAFETY CHECKS ON FULL CLAIM SET');

    const distinctLEs = new Set(allF63Claims.map(c => c.subjectLeId));
    const distinctFields = new Set(allF63Claims.map(c => c.fieldNo));

    if (distinctLEs.size > 1) {
        fail(`ABORT: Claims span ${distinctLEs.size} LEs. Expected exactly 1.`);
        process.exit(1);
    }
    if (distinctFields.size > 1) {
        fail(`ABORT: Claims span ${distinctFields.size} fieldNos. Expected exactly 1.`);
        process.exit(1);
    }

    ok(`All claims belong to exactly one LE: ${[...distinctLEs][0]}`);
    ok(`All claims belong to exactly one fieldNo: ${[...distinctFields][0]}`);

    // ── 4. Apply targeting filter ─────────────────────────────────────────────
    box('4. TARGETING FILTER');

    const targetedClaims = allF63Claims.filter(c => {
        // Only auto_* instanceIds
        if (!c.instanceId?.startsWith('auto_')) return false;
        // Only REGISTRATION_AUTHORITY source
        if (c.sourceType !== 'REGISTRATION_AUTHORITY') return false;
        // Skip already-REJECTED
        if (c.status === ClaimStatus.REJECTED) return false;
        // Skip existing tombstones
        const json = c.valueJson as any;
        if (json?.tombstone === true) return false;
        return true;
    });

    // Explain what was excluded
    const excluded = allF63Claims.filter(c => !targetedClaims.includes(c));
    const excludedUserInput  = excluded.filter(c => c.sourceType === 'USER_INPUT');
    const excludedTombstones = excluded.filter(c => (c.valueJson as any)?.tombstone === true);
    const excludedRowStar    = excluded.filter(c => c.instanceId?.startsWith('row_'));
    const excludedChStar     = excluded.filter(c => c.instanceId?.startsWith('ch_'));
    const excludedRejected   = excluded.filter(c => c.status === ClaimStatus.REJECTED);
    const excludedOther      = excluded.filter(c =>
        !excludedUserInput.includes(c) && !excludedTombstones.includes(c) &&
        !excludedRowStar.includes(c) && !excludedChStar.includes(c) && !excludedRejected.includes(c)
    );

    console.log(`\n  Targeted (auto_* RA claims)  : ${targetedClaims.length}`);
    console.log(`  Excluded — USER_INPUT        : ${excludedUserInput.length}  ✅ protected`);
    console.log(`  Excluded — existing tombstone: ${excludedTombstones.length}  ✅ already suppressed`);
    console.log(`  Excluded — row_* instanceId  : ${excludedRowStar.length}  ✅ protected`);
    console.log(`  Excluded — ch_* instanceId   : ${excludedChStar.length}  ✅ protected`);
    console.log(`  Excluded — REJECTED status   : ${excludedRejected.length}  ✅ protected`);
    console.log(`  Excluded — other             : ${excludedOther.length}`);

    if (excludedOther.length > 0) {
        warn('Unclassified excluded claims:');
        excludedOther.forEach(c => console.log(`    [${c.id.slice(0,8)}] src=${c.sourceType} instanceId=${c.instanceId} status=${c.status}`));
    }

    // ── 5. Count guardrail ───────────────────────────────────────────────────
    if (targetedClaims.length > MAX_SAFE_TARGET_COUNT) {
        fail(`ABORT: ${targetedClaims.length} claims targeted — exceeds safety limit of ${MAX_SAFE_TARGET_COUNT}.`);
        fail('This is unexpected. Investigate before running.');
        process.exit(1);
    }

    // ── 6. Existing tombstone detection ──────────────────────────────────────
    box('5. EXISTING TOMBSTONE CHECK');

    // For each targeted claim, check if a tombstone already exists for that (instanceId, collectionId)
    const existingTombstones = allF63Claims.filter(c => (c.valueJson as any)?.tombstone === true);
    const alreadyTombstonedSlots = new Set(existingTombstones.map(c => `${c.collectionId}:${c.instanceId}`));

    const wouldSkip: typeof targetedClaims = [];
    const wouldTombstone: typeof targetedClaims = [];

    for (const claim of targetedClaims) {
        const slotKey = `${claim.collectionId}:${claim.instanceId}`;
        if (alreadyTombstonedSlots.has(slotKey)) {
            wouldSkip.push(claim);
        } else {
            wouldTombstone.push(claim);
        }
    }

    console.log(`\n  Already tombstoned slots (will skip): ${wouldSkip.length}`);
    console.log(`  Slots needing tombstone              : ${wouldTombstone.length}`);

    if (wouldSkip.length > 0) {
        warn('These slots already have tombstones and will be skipped:');
        wouldSkip.forEach(c => console.log(`    instanceId=${c.instanceId} (slot already suppressed)`));
    }

    // ── 7. Full candidate report ──────────────────────────────────────────────
    box('6. FULL CANDIDATE REPORT — rows that WOULD be tombstoned');

    if (wouldTombstone.length === 0) {
        console.log('\n  Nothing to tombstone. All targeted slots are already suppressed.');
    } else {
        console.log(`\n  ${'claimId'.padEnd(10)}  ${'instanceId'.padEnd(30)}  ${'person/entity'.padEnd(35)}  ${'status'.padEnd(10)}  ${'assertedAt'}`);
        console.log(`  ${'─'.repeat(10)}  ${'─'.repeat(30)}  ${'─'.repeat(35)}  ${'─'.repeat(10)}  ${'─'.repeat(20)}`);
        wouldTombstone.forEach(c => {
            const name = c.valuePerson
                ? `${(c.valuePerson as any).firstName ?? ''} ${(c.valuePerson as any).lastName ?? ''}`.trim()
                : c.valueLeId ? `LE:${c.valueLeId.slice(0, 8)}` : '—';
            console.log(`  ${c.id.slice(0,8).padEnd(10)}  ${(c.instanceId ?? 'null').padEnd(30)}  ${name.padEnd(35)}  ${c.status.padEnd(10)}  ${c.assertedAt.toISOString().slice(0,19)}`);
        });
    }

    // ── 8. Tombstone plan ────────────────────────────────────────────────────
    box('7. TOMBSTONE PLAN');

    console.log('\n  Each tombstone will be:');
    console.log('  ┌───────────────────────────────────────────────────────────────┐');
    console.log(`  │  fieldNo        = ${TARGET_FIELD_NO}                                              │`);
    console.log(`  │  subjectLeId    = (same as original claim)                    │`);
    console.log(`  │  collectionId   = (same as original claim)                    │`);
    console.log(`  │  instanceId     = (same as original claim — auto_*)           │`);
    console.log(`  │  valueJson      = { "tombstone": true }                       │`);
    console.log(`  │  sourceType     = SYSTEM_DERIVED                              │`);
    console.log(`  │  status         = ASSERTED (default from emitTombstone)       │`);
    console.log('  └───────────────────────────────────────────────────────────────┘');

    console.log('\n  Why SYSTEM_DERIVED sourceType?');
    console.log('    • Not USER_INPUT — this is not a human decision about the data');
    console.log('    • Not REGISTRATION_AUTHORITY — this did not come from CH');
    console.log('    • SYSTEM_DERIVED = system-generated corrective action');
    console.log('    • This correctly signals: "system identified these as pre-rowKey artefacts"');

    console.log('\n  How tombstones supersede the old slots:');
    console.log('    1. getAuthoritativeCollection() groups by (collectionId, instanceId)');
    console.log('    2. pickWinner() sorts tombstones FIRST within each status tier');
    console.log('    3. tombstone wins → isTombstone(winner) === true → slot excluded from results');
    console.log('    4. New ch_* claims have different instanceIds → separate slots → visible');
    console.log('    5. Result: old auto_* slots suppressed, new ch_* slots visible');

    console.log(`\n  Summary:`);
    console.log(`    Tombstones to emit  : ${wouldTombstone.length}`);
    console.log(`    Slots already clean : ${wouldSkip.length}`);
    console.log(`    Total targeted      : ${targetedClaims.length}`);

    // ── 9. Dry run exit ──────────────────────────────────────────────────────
    if (!IS_EXECUTE) {
        box('DRY RUN COMPLETE — No data was written');
        console.log('\n  To execute, run:');
        console.log('    npx ts-node --compiler-options \'{"module":"CommonJS"}\' scratch/tombstone-auto-claims.ts --execute');
        console.log('\n  Recommendation: review the candidate report above carefully before executing.');
        await prisma.$disconnect();
        return;
    }

    // ── 10. Execute mode: final confirmation banner ───────────────────────────
    box('⚠️  EXECUTE MODE — WRITING TOMBSTONES IN 3...');
    console.log('\n  The following will be written:');
    console.log(`    • ${wouldTombstone.length} tombstone FieldClaims`);
    console.log('    • sourceType = SYSTEM_DERIVED');
    console.log('    • No existing rows will be deleted or modified');
    console.log('    • This action is reversible by rejecting the tombstone claims');
    console.log('\n  Proceeding...\n');

    // ── 11. Execute tombstones ────────────────────────────────────────────────
    let emitted = 0;
    let failed  = 0;
    const errors: string[] = [];

    for (const claim of wouldTombstone) {
        try {
            await FieldClaimService.emitTombstone(
                { subjectLeId },
                TARGET_FIELD_NO,
                claim.collectionId ?? 'GENERAL',  // must match original claim's collectionId
                claim.instanceId!,                 // the auto_* key
                null,                              // baseline scope (ownerScopeId = null)
                TOMBSTONE_SOURCE
            );
            console.log(`  ✅  Tombstoned: ${claim.instanceId}`);
            emitted++;
        } catch (e: any) {
            const msg = `FAILED: ${claim.instanceId} — ${e.message}`;
            console.error(`  ❌  ${msg}`);
            errors.push(msg);
            failed++;
        }
    }

    // ── 12. Post-execute report ───────────────────────────────────────────────
    box('12. EXECUTION SUMMARY');
    console.log(`\n  Tombstones emitted  : ${emitted}`);
    console.log(`  Failures            : ${failed}`);
    console.log(`  Already suppressed  : ${wouldSkip.length} (skipped correctly)`);

    if (errors.length > 0) {
        console.log('\n  Errors:');
        errors.forEach(e => console.log(`    ❌  ${e}`));
    }

    if (failed === 0) {
        console.log('\n  ✅ Cleanup complete. Next steps:');
        console.log('    1. Run the inspector script to verify old slots are now suppressed');
        console.log('    2. Trigger ONE enrichment run for this LE');
        console.log('    3. Re-run inspector to confirm ch_* rows with correct temporal data');
        console.log('    4. Verify UI shows exactly 4 current directors');
    } else {
        warn(`${failed} tombstone(s) failed. Inspect errors above. Do NOT run enrichment until resolved.`);
    }

    await prisma.$disconnect();
}

main().catch(e => {
    console.error('\n  ❌ FATAL ERROR:', e);
    process.exit(1);
});
