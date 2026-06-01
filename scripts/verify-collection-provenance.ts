/**
 * scripts/verify-collection-provenance.ts
 *
 * Dev verification for collection-level provenance and re-enrichment tombstone behaviour.
 *
 * Tests:
 *   1. user tombstone blocks re-enrichment
 *   2. user re-add after tombstone works (item reappears)
 *   3. isUserCurated = true after user tombstone (even with empty collection)
 *   4. isUserCurated = true after user-added value
 *   5. isUserCurated = false for pure Companies House collection
 *
 * Uses the first entity that has SIC_CODES claims in dev.
 *
 * Run: npx tsx scripts/verify-collection-provenance.ts
 */

import prisma from '../src/lib/prisma';
import { KycStateService } from '../src/lib/kyc/KycStateService';
import { FieldClaimService } from '../src/lib/kyc/FieldClaimService';
import { KycWriteService } from '../src/services/kyc/KycWriteService';
import { SourceType, ClaimStatus } from '@prisma/client';

const FIELD_NO = 20;
const COLLECTION_ID = 'SIC_CODES';

async function findTestEntity(): Promise<{ subjectLeId: string; existingClaim: any }> {
    const claim = await prisma.fieldClaim.findFirst({
        where: { fieldNo: FIELD_NO, collectionId: COLLECTION_ID, sourceType: 'REGISTRATION_AUTHORITY' },
        orderBy: { assertedAt: 'desc' }
    });
    if (!claim?.subjectLeId || !claim.instanceId) throw new Error('No SIC_CODES claims found in dev DB. Run backfill first.');
    return { subjectLeId: claim.subjectLeId, existingClaim: claim };
}

async function cleanupTestClaims(subjectLeId: string, instanceId: string) {
    // Remove only USER_INPUT test claims for this instanceId — leave RA claims alone
    await prisma.fieldClaim.deleteMany({
        where: { subjectLeId, fieldNo: FIELD_NO, instanceId, sourceType: 'USER_INPUT' }
    });
    console.log(`  [cleanup] Removed USER_INPUT test claims for instanceId=${instanceId}`);
}

function pass(msg: string) { console.log(`  ✅ PASS: ${msg}`); }
function fail(msg: string) { console.error(`  ❌ FAIL: ${msg}`); process.exitCode = 1; }

async function main() {
    console.log('\n── Collection Provenance Verification ──\n');

    const { subjectLeId, existingClaim } = await findTestEntity();
    const instanceId = existingClaim.instanceId as string;  // e.g. sic_35110
    const ownerScopeId = existingClaim.ownerScopeId;

    console.log(`Entity: subjectLeId=${subjectLeId}`);
    console.log(`Test instanceId: ${instanceId}\n`);

    // ── Test 0: Baseline — pure CH collection ────────────────────────────────
    console.log('── Test 0: Baseline isUserCurated ──');
    await cleanupTestClaims(subjectLeId, instanceId);

    const userClaimBefore = await prisma.fieldClaim.findFirst({
        where: { subjectLeId, fieldNo: FIELD_NO, sourceType: 'USER_INPUT' }
    });
    if (!userClaimBefore) {
        pass('isUserCurated = false for pure CH collection (no USER_INPUT claims)');
    } else {
        fail(`Expected no USER_INPUT claims but found ${userClaimBefore.id}`);
    }

    // ── Test 1: Tombstone blocks re-enrichment ────────────────────────────────
    console.log('\n── Test 1: User tombstone blocks re-enrichment ──');

    // Emit a USER_INPUT tombstone for this instanceId (VERIFIED immediately, matching production removeMultiValueEntry)
    const tombstone = await FieldClaimService.assertClaim({
        fieldNo: FIELD_NO,
        subjectLeId,
        ownerScopeId: ownerScopeId ?? undefined,
        collectionId: COLLECTION_ID,
        instanceId,
        valueJson: { tombstone: true },
        sourceType: SourceType.USER_INPUT,
        status: ClaimStatus.VERIFIED,
    });
    console.log(`  Tombstone written: ${tombstone.id}`);

    // Now attempt to re-enrich (simulate KycWriteService.updateField)
    const writeService = new KycWriteService();
    const written = await (writeService as any).updateField(
        subjectLeId,
        FIELD_NO,
        existingClaim.valueJson,
        { source: 'REGISTRATION_AUTHORITY', reason: 'COMPANIES_HOUSE' },
        instanceId,
        'LEGAL_ENTITY'
    );

    if (written === true) {
        pass('Re-enrichment was skipped (returned true) — user exclusion active');
    } else if (written === false) {
        fail('updateField returned false (overwrite denied) — not the expected user-exclusion path');
    }

    // Confirm no new RA claim was written after the tombstone
    const claimsAfterReEnrich = await prisma.fieldClaim.findMany({
        where: { subjectLeId, fieldNo: FIELD_NO, instanceId, sourceType: 'REGISTRATION_AUTHORITY' },
        orderBy: { assertedAt: 'desc' }
    });
    const latestRA = claimsAfterReEnrich[0];
    if (latestRA && latestRA.id !== existingClaim.id) {
        fail(`A new RA claim was written after tombstone: ${latestRA.id}`);
    } else {
        pass('No new RA claim written — tombstone preserved correctly');
    }

    // ── Test 2: isUserCurated after tombstone ─────────────────────────────────
    console.log('\n── Test 2: isUserCurated = true after USER_INPUT tombstone ──');

    const userClaimAfterTombstone = await prisma.fieldClaim.findFirst({
        where: { subjectLeId, fieldNo: FIELD_NO, sourceType: 'USER_INPUT' }
    });
    if (userClaimAfterTombstone) {
        pass('isUserCurated = true (USER_INPUT tombstone exists)');
    } else {
        fail('Expected USER_INPUT tombstone claim to exist');
    }

    // ── Test 3: Collection is empty after tombstone (item no longer shown) ────
    console.log('\n── Test 3: Tombstoned item does not appear in getAuthoritativeCollection ──');

    const collectionAfterTombstone = await KycStateService.getAuthoritativeCollection(
        { subjectLeId },
        FIELD_NO,
        ownerScopeId ?? undefined
    );
    const tombstonedItem = collectionAfterTombstone.find(r => r.instanceId === instanceId);
    if (!tombstonedItem) {
        pass(`instanceId=${instanceId} not present in collection after tombstone`);
    } else {
        fail(`instanceId=${instanceId} still appears in collection after tombstone`);
    }

    // ── Test 4: User re-add works (item reappears with USER_INPUT source) ─────
    console.log('\n── Test 4: User re-add after tombstone ──');

    // Write a USER_INPUT value claim for the same instanceId (newer than tombstone)
    await new Promise(r => setTimeout(r, 50)); // Ensure assertedAt is strictly after tombstone
    const readdClaim = await FieldClaimService.assertClaim({
        fieldNo: FIELD_NO,
        subjectLeId,
        ownerScopeId: ownerScopeId ?? undefined,
        collectionId: COLLECTION_ID,
        instanceId,
        valueJson: existingClaim.valueJson,
        sourceType: SourceType.USER_INPUT,
        status: ClaimStatus.VERIFIED,
    });
    console.log(`  Re-add claim written: ${readdClaim.id}`);

    const collectionAfterReadd = await KycStateService.getAuthoritativeCollection(
        { subjectLeId },
        FIELD_NO,
        ownerScopeId ?? undefined
    );
    const readdedItem = collectionAfterReadd.find(r => r.instanceId === instanceId);
    if (readdedItem) {
        pass(`instanceId=${instanceId} reappears in collection after re-add`);
        if (readdedItem.sourceType === 'USER_INPUT') {
            pass('Re-added item has sourceType=USER_INPUT');
        } else {
            fail(`Expected USER_INPUT but got ${readdedItem.sourceType}`);
        }
    } else {
        fail(`instanceId=${instanceId} NOT present in collection after re-add`);
    }

    // ── Test 5: isUserCurated = true after user-added value ──────────────────
    console.log('\n── Test 5: isUserCurated = true with user-added value ──');

    const userClaimAfterReadd = await prisma.fieldClaim.findFirst({
        where: { subjectLeId, fieldNo: FIELD_NO, sourceType: 'USER_INPUT' }
    });
    if (userClaimAfterReadd) {
        pass('isUserCurated = true (USER_INPUT value claim exists after re-add)');
    } else {
        fail('No USER_INPUT claim found after re-add');
    }

    // ── Cleanup ───────────────────────────────────────────────────────────────
    console.log('\n── Cleanup ──');
    await cleanupTestClaims(subjectLeId, instanceId);
    console.log('  USER_INPUT test claims removed. RA claim restored as authoritative.');

    console.log('\n── Done ──\n');
    await prisma.$disconnect();
}

main().catch(e => {
    console.error('Verification failed with exception:', e);
    process.exit(1);
});
