/**
 * validate-write-path.ts
 *
 * Dry-run simulation of the current write path for Field 63.
 * Reads live CH officers payload from DB, runs the transforms, and shows
 * exactly what would be written — WITHOUT modifying any data.
 *
 * Run: npx ts-node --compiler-options '{"module":"CommonJS"}' scratch/validate-write-path.ts
 */

import { PrismaClient } from '@prisma/client';
import { applyTransform, buildDirectorRowKey } from '../src/services/kyc/normalization/transforms';

const prisma = new PrismaClient();

const LE_ID  = '3f3b592b-20e3-46c8-9eb1-9af01958f99f';
const FIELD_NO = 63;

function hr(label: string) {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`  ${label}`);
    console.log('═'.repeat(70));
}

async function main() {
    hr('0. CONTEXT');

    const clientLE = await prisma.clientLE.findUnique({
        where: { id: LE_ID },
        select: { id: true, name: true, legalEntityId: true }
    });
    console.log(`  Entity: ${clientLE?.name} (${LE_ID})`);

    // ── 1. Find latest OFFICERS payload ──────────────────────────────────────
    hr('1. SOURCE PAYLOAD — latest OFFICERS payload');

    const payload = await (prisma as any).registrySourcePayload.findFirst({
        where: { legalEntityId: LE_ID, payloadSubtype: 'OFFICERS' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, payloadSubtype: true, createdAt: true, payload: true, sourceReference: true }
    });

    if (!payload) {
        console.log('  ❌ No OFFICERS payload found for this LE.');
        console.log('  This means enrichment has never run with payloadSubtype=OFFICERS,');
        console.log('  or the source mapping was broken (payloadSubtype was GENERAL).');
        console.log('  The source mapping fix only applies to FUTURE runs.');

        // Check for any payloads at all
        const anyPayloads = await (prisma as any).registrySourcePayload.findMany({
            where: { legalEntityId: LE_ID },
            select: { payloadSubtype: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 5
        });
        console.log(`\n  Existing payloads for this LE:`);
        anyPayloads.forEach((p: any) => console.log(`    ${p.payloadSubtype} @ ${p.createdAt.toISOString()}`));
        await prisma.$disconnect();
        return;
    }

    console.log(`  Payload ID      : ${payload.id}`);
    console.log(`  Subtype         : ${payload.payloadSubtype}`);
    console.log(`  Source RA       : ${payload.sourceReference}`);
    console.log(`  Created at      : ${payload.createdAt.toISOString()}`);

    // ── 2. Resolve source path ────────────────────────────────────────────────
    hr('2. PATH RESOLUTION — officers from payload');

    const rawPayload = payload.payload as any;
    // CH officers payload structure: { items: [...], active_count, resigned_count, ... }
    const officersRaw = rawPayload?.items ?? rawPayload?.officers ?? rawPayload;
    
    if (!Array.isArray(officersRaw)) {
        console.log('  ❌ Could not resolve officers array from payload.');
        console.log('  Payload top-level keys:', Object.keys(rawPayload || {}).join(', '));
        await prisma.$disconnect();
        return;
    }

    console.log(`  Officers found in payload: ${officersRaw.length}`);
    console.log(`  First raw item keys: ${Object.keys(officersRaw[0] || {}).join(', ')}`);

    // ── 3. Apply TO_PARTY_LIST transform ─────────────────────────────────────
    hr('3. TRANSFORM — TO_PARTY_LIST');

    const transformed = applyTransform(officersRaw, 'TO_PARTY_LIST', undefined);

    console.log(`  transformed.value length : ${Array.isArray(transformed.value) ? transformed.value.length : 'not array'}`);
    console.log(`  transformed.rowKeys      : ${JSON.stringify(transformed.rowKeys)}`);
    console.log(`  confidencePenalty        : ${transformed.confidencePenalty}`);

    // ── 4. Simulate fan-out (what applyFieldCandidate would do) ───────────────
    hr('4. FAN-OUT SIMULATION — what would be written');

    if (!Array.isArray(transformed.value)) {
        console.log('  ❌ Transform did not return an array — cannot fan out.');
        await prisma.$disconnect();
        return;
    }

    console.log('\n  [Simulated FieldClaims that would be CREATED on next enrichment]');
    console.log('  ─────────────────────────────────────────────────────────────────');
    console.log('  idx  rowKey                              effectiveFrom  effectiveTo  name');
    console.log('  ─────────────────────────────────────────────────────────────────');

    let deterministicCount = 0;
    let ephemeralCount = 0;
    let effectiveFromCount = 0;
    let effectiveToCount = 0;

    for (let i = 0; i < transformed.value.length; i++) {
        const item = transformed.value[i];
        const stableKey = transformed.rowKeys?.[i] || item?.rowKey;
        const rowId = stableKey || `auto_${Date.now()}_${i}`;

        const effectiveFrom: Date | undefined = item?.appointedOn ? new Date(item.appointedOn) : undefined;
        const effectiveTo:   Date | undefined = item?.resignedOn  ? new Date(item.resignedOn)  : undefined;

        if (stableKey && stableKey.startsWith('ch_')) deterministicCount++;
        else ephemeralCount++;
        if (effectiveFrom) effectiveFromCount++;
        if (effectiveTo)   effectiveToCount++;

        const name = item?.metadata_type === 'LEGAL_ENTITY'
            ? item?.name || '(corporate)'
            : `${item?.firstName || ''} ${item?.lastName || ''}`.trim() || '(unknown)';

        console.log(`  [${i.toString().padStart(2)}]  ${rowId.padEnd(36)}  ${(effectiveFrom?.toISOString().slice(0,10) ?? 'null').padEnd(13)}  ${(effectiveTo?.toISOString().slice(0,10) ?? 'null').padEnd(11)}  ${name}`);
    }

    console.log('\n  ─────────────────────────────────────────────────────────────────');
    console.log(`  Deterministic rowKeys (ch_*) : ${deterministicCount}  ${deterministicCount > 0 ? '✅' : '❌'}`);
    console.log(`  Ephemeral rowKeys (auto_*)   : ${ephemeralCount}      ${ephemeralCount > 0 ? '⚠️' : '✅'}`);
    console.log(`  effectiveFrom populated      : ${effectiveFromCount}  ${effectiveFromCount > 0 ? '✅' : '⚠️ — CH data has no appointed_on?'}`);
    console.log(`  effectiveTo populated        : ${effectiveToCount}    ${effectiveToCount > 0 ? '✅ resigned directors present' : '(0 — no resigned officers in payload)'}`);

    // ── 5. Check for collisions with existing claims ─────────────────────────
    hr('5. COLLISION CHECK — would new rowKeys collide with existing?');

    const existingClaims = await prisma.fieldClaim.findMany({
        where: { fieldNo: FIELD_NO, subjectLeId: clientLE!.legalEntityId! },
        select: { instanceId: true, status: true, sourceType: true }
    });
    const existingInstanceIds = new Set(existingClaims.map(c => c.instanceId).filter(Boolean));
    
    const newKeys = transformed.rowKeys?.filter(k => k) ?? [];
    const collisions = newKeys.filter(k => existingInstanceIds.has(k));
    const genuinelyNew = newKeys.filter(k => !existingInstanceIds.has(k));
    
    console.log(`  Existing claim instanceIds : ${existingInstanceIds.size}`);
    console.log(`  New rowKeys to be written  : ${newKeys.length}`);
    console.log(`  Collisions (same key)      : ${collisions.length}  ${collisions.length > 0 ? '⚠️ duplicates would be ADDED (no upsert)' : '✅ no collision'}`);
    console.log(`  Genuinely new claims       : ${genuinelyNew.length}`);

    if (collisions.length > 0) {
        console.log('\n  Collision details:');
        collisions.forEach(k => console.log(`    ${k}`));
        console.log('\n  ⚠️  assertClaim() uses prisma.fieldClaim.CREATE — it does not upsert.');
        console.log('  Existing claims with same instanceId will NOT be superseded.');
        console.log('  pickWinner() will select one, but both rows accumulate.');
    }

    // ── 6. Raw item sample for verification ──────────────────────────────────
    hr('6. RAW PAYLOAD SAMPLE — first 3 officers');

    officersRaw.slice(0, 3).forEach((item: any, i: number) => {
        console.log(`\n  Officer [${i}]:`);
        console.log(`    name           : ${item.name}`);
        console.log(`    officer_role   : ${item.officer_role}`);
        console.log(`    appointed_on   : ${item.appointed_on ?? 'null'}`);
        console.log(`    resigned_on    : ${item.resigned_on ?? 'null'}`);
        console.log(`    nationality    : ${item.nationality ?? 'null'}`);
        console.log(`    dob            : ${JSON.stringify(item.date_of_birth) ?? 'null'}`);
    });

    // ── 7. Final verdict ─────────────────────────────────────────────────────
    hr('7. VERDICT — is the new write path correct?');

    const checks = [
        { label: 'TO_PARTY_LIST returns array',          pass: Array.isArray(transformed.value) },
        { label: 'rowKeys are generated',                pass: (transformed.rowKeys?.length ?? 0) > 0 },
        { label: 'rowKeys are deterministic (ch_*)',     pass: deterministicCount > 0 },
        { label: 'effectiveFrom populated from CH data', pass: effectiveFromCount > 0 },
        { label: 'No collision with existing claims',    pass: collisions.length === 0 },
    ];

    checks.forEach(c => {
        console.log(`  ${c.pass ? '✅' : '❌'}  ${c.label}`);
    });

    await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
