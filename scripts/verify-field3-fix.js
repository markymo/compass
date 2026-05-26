#!/usr/bin/env node
/**
 * Production verification script for getAuthoritativeValue fix.
 * Checks: FieldClaims, SourceFieldMapping priorities, and simulates pickWinner.
 * Uses environment from .env (production Neon DB).
 */

const { PrismaClient } = require('@prisma/client');

const LE_ID   = '7b34ab95-b350-493f-9df1-75929338f6d1'; // Lynn Wind Farm — ClientLE id
const FIELD_3 = 3;

const prisma = new PrismaClient({
    log: ['error'],
});

async function main() {
    console.log('='.repeat(70));
    console.log('PRODUCTION VERIFICATION — KycStateService getAuthoritativeValue fix');
    console.log('='.repeat(70));

    // ── 1. Resolve LegalEntity subject from ClientLE ───────────────────────
    const clientLE = await prisma.clientLE.findUnique({
        where: { id: LE_ID },
        select: { id: true, legalEntityId: true, name: true },
    });

    if (!clientLE) {
        console.error(`\n❌ ClientLE ${LE_ID} not found in DB`);
        process.exit(1);
    }

    console.log(`\n📋 ClientLE: ${clientLE.name} (${clientLE.id})`);
    console.log(`   LegalEntity: ${clientLE.legalEntityId}`);

    const subjectLeId = clientLE.legalEntityId;

    // ── 2. FieldClaims for Field 3 ─────────────────────────────────────────
    const claims = await prisma.fieldClaim.findMany({
        where: {
            fieldNo: FIELD_3,
            subjectLeId,
            status: { in: ['VERIFIED', 'ASSERTED'] },
        },
        orderBy: [{ assertedAt: 'desc' }],
        select: {
            id: true,
            sourceType: true,
            sourceReference: true,
            status: true,
            confidenceScore: true,
            assertedAt: true,
            ownerScopeId: true,
            valueText: true,
        },
    });

    console.log(`\n── FieldClaims for Field ${FIELD_3} ─────────────────────────────────`);
    if (claims.length === 0) {
        console.log('   ⚠️  No VERIFIED/ASSERTED claims found for Field 3');
    } else {
        for (const c of claims) {
            const marker = c.sourceType === 'REGISTRATION_AUTHORITY' && c.sourceReference === 'RA000585'
                ? '✅' : c.sourceType === 'GLEIF' ? '🔵' : '⚪';
            console.log(`   ${marker} id=${c.id}`);
            console.log(`      sourceType=${c.sourceType}  sourceReference=${c.sourceReference ?? 'null'}`);
            console.log(`      status=${c.status}  confidence=${c.confidenceScore ?? 'null'}`);
            console.log(`      assertedAt=${c.assertedAt.toISOString()}`);
            console.log(`      value="${c.valueText ?? '(non-text)'}"`);
            console.log(`      ownerScope=${c.ownerScopeId ?? 'null (baseline)'}`);
            console.log();
        }
    }

    // ── 3. SourceFieldMapping priorities for Field 3 ───────────────────────
    const mappings = await (prisma).sourceFieldMapping.findMany({
        where: { targetFieldNo: FIELD_3 },
        orderBy: { priority: 'asc' },
        select: {
            id: true,
            sourceType: true,
            sourceReference: true,
            targetFieldNo: true,
            mappingScope: true,
            priority: true,
            isActive: true,
        },
    });

    console.log(`── SourceFieldMappings for targetFieldNo=${FIELD_3} ──────────────────`);
    if (mappings.length === 0) {
        console.log('   ⚠️  No mappings found for Field 3');
    } else {
        for (const m of mappings) {
            const active = m.isActive ? '✅' : '❌';
            const scoped = m.sourceReference ? `ref=${m.sourceReference}` : 'ref=null (generic)';
            console.log(`   ${active} P${m.priority}  ${m.sourceType} / ${scoped}  scope=${m.mappingScope}`);
        }
    }

    // ── 4. Simulate pickWinner priority resolution ─────────────────────────
    console.log(`\n── Priority resolution simulation ──────────────────────────────────`);

    const activeMappings = mappings.filter(m => m.isActive);

    // Build priorityMap (scoped preferred over generic)
    const generic = new Map();
    const scoped  = new Map();

    for (const row of activeMappings) {
        const key = `${row.sourceType}:${row.sourceReference ?? '__null__'}`;
        if (row.sourceReference === null) {
            const ex = generic.get(key);
            if (ex === undefined || row.priority < ex) generic.set(key, row.priority);
        } else {
            const ex = scoped.get(key);
            if (ex === undefined || row.priority < ex) scoped.set(key, row.priority);
        }
    }
    const priorityMap = new Map([...generic, ...scoped]);

    const FALLBACK = { GLEIF: 500, REGISTRATION_AUTHORITY: 500, AI_EXTRACTION: 800, SYSTEM_DERIVED: 900 };

    const resolvePriority = (claim) => {
        if (claim.sourceType === 'USER_INPUT') return 0;
        const exactKey = `${claim.sourceType}:${claim.sourceReference ?? '__null__'}`;
        const exact = priorityMap.get(exactKey);
        if (exact !== undefined) return exact;
        if (claim.sourceReference !== null) {
            const genericKey = `${claim.sourceType}:__null__`;
            const gen = priorityMap.get(genericKey);
            if (gen !== undefined) return gen;
        }
        return FALLBACK[claim.sourceType] ?? 1000;
    };

    const TIER_LABELS = ['ASSERTED-baseline', 'VERIFIED-baseline', 'ASSERTED-scoped', 'VERIFIED-scoped'];

    // Tier 4 ASSERTED baseline (no scope set for this entity)
    const assertedBaseline = claims.filter(c => c.status === 'ASSERTED' && c.ownerScopeId === null);
    const verifiedBaseline = claims.filter(c => c.status === 'VERIFIED' && c.ownerScopeId === null);

    const sorted = [...assertedBaseline].sort((a, b) => {
        const pA = resolvePriority(a), pB = resolvePriority(b);
        if (pA !== pB) return pA - pB;
        return b.assertedAt.getTime() - a.assertedAt.getTime();
    });

    console.log('   Tier 3 (VERIFIED baseline):');
    if (verifiedBaseline.length === 0) console.log('      (empty)');
    verifiedBaseline.forEach(c => {
        const p = resolvePriority(c);
        console.log(`      P${p}  ${c.sourceType}/${c.sourceReference ?? 'null'}  → "${c.valueText}"`);
    });

    console.log('   Tier 4 (ASSERTED baseline) — sorted by priority:');
    if (sorted.length === 0) console.log('      (empty)');
    sorted.forEach((c, i) => {
        const p = resolvePriority(c);
        const winner = i === 0 ? ' ← WINNER' : '';
        console.log(`      #${i+1}  P${p}  ${c.sourceType}/${c.sourceReference ?? 'null'}  → "${c.valueText}"${winner}`);
    });

    const winnerClaim = verifiedBaseline.length > 0
        ? verifiedBaseline.sort((a, b) => resolvePriority(a) - resolvePriority(b))[0]
        : sorted[0];

    console.log('\n── Expected authoritative result ───────────────────────────────────');
    if (!winnerClaim) {
        console.log('   ❌ No winner — null returned');
    } else {
        const pass =
            winnerClaim.sourceType === 'REGISTRATION_AUTHORITY' &&
            winnerClaim.sourceReference === 'RA000585';
        console.log(`   sourceType     : ${winnerClaim.sourceType}`);
        console.log(`   sourceReference: ${winnerClaim.sourceReference ?? 'null'}`);
        console.log(`   value          : "${winnerClaim.valueText}"`);
        console.log(`   assertedAt     : ${winnerClaim.assertedAt.toISOString()}`);
        console.log(pass
            ? '\n   ✅ PASS — Companies House / RA000585 is the authoritative winner'
            : '\n   ❌ FAIL — expected REGISTRATION_AUTHORITY/RA000585 to win');
    }

    console.log('\n' + '='.repeat(70));
}

main()
    .catch(e => { console.error('\n❌ Script error:', e.message); process.exit(1); })
    .finally(() => prisma.$disconnect());
