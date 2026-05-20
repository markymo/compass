/**
 * seed-directors-wiring.ts
 *
 * Idempotent script to wire Field 63 (Current Directors) for V1.
 *
 * Changes made:
 * 1. Fix SourceFieldMapping for F63 — payloadSubtype was 'GENERAL', must be 'OFFICERS'
 * 2. Fix SourceFieldMapping for F62 — payloadSubtype was 'GENERAL', must be 'PSC'
 * 3. Fix MasterFieldGraphBinding for F63 — filterEdgeType was null, should be 'DIRECTOR'
 *
 * SAFE: upsert/update only. No rows created unless they don't exist.
 * IDEMPOTENT: can be run multiple times without side effects.
 *
 * Run with:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-directors-wiring.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('[seed-directors-wiring] Starting...\n');

    // ── 1. Fix F63 Source Mapping (officers → payloadSubtype: OFFICERS) ─────────
    //
    // Current state:  sourcePath='officers', payloadSubtype='GENERAL'
    // Correct state:  sourcePath='officers', payloadSubtype='OFFICERS'
    //
    // The CH enrichment pipeline stores officer data in a separate RegistrySourcePayload
    // row with payloadSubtype='OFFICERS'. RegistryMappingEngine.mapEnrichmentRun() matches
    // mapping.payloadSubtype === payload.payloadSubtype — so 'GENERAL' will never match.

    const f63MappingUpdate = await (prisma as any).sourceFieldMapping.updateMany({
        where: {
            targetFieldNo: 63,
            sourceType: 'REGISTRATION_AUTHORITY',
            sourcePath: 'officers',
            payloadSubtype: 'GENERAL',
        },
        data: {
            payloadSubtype: 'OFFICERS',
            notes: 'CH Officers → Field 63 (Current Directors). payloadSubtype corrected 2026-05-19.',
        },
    });
    console.log(`[F63 source mapping]  Updated ${f63MappingUpdate.count} row(s) — GENERAL → OFFICERS`);

    // ── 2. Fix F62 Source Mapping (pscs → payloadSubtype: PSC) ──────────────────
    //
    // Same issue: PSCs are stored under payloadSubtype='PSC', not 'GENERAL'.

    const f62MappingUpdate = await (prisma as any).sourceFieldMapping.updateMany({
        where: {
            targetFieldNo: 62,
            sourceType: 'REGISTRATION_AUTHORITY',
            sourcePath: 'pscs',
            payloadSubtype: 'GENERAL',
        },
        data: {
            payloadSubtype: 'PSC',
            notes: 'CH PSCs → Field 62 (UBOs). payloadSubtype corrected 2026-05-19.',
        },
    });
    console.log(`[F62 source mapping]  Updated ${f62MappingUpdate.count} row(s) — GENERAL → PSC`);

    // ── 3. Fix MasterFieldGraphBinding for F63 (add filterEdgeType: DIRECTOR) ───
    //
    // filterEdgeType=null means the GraphNodePicker shows all PERSON nodes without
    // any prioritisation of DIRECTOR-linked nodes. Setting it to 'DIRECTOR' causes
    // the picker to promote nodes already connected via DIRECTOR edges to the top.
    // This does NOT exclude other nodes — just improves UX.

    const bindingUpdate = await (prisma as any).masterFieldGraphBinding.updateMany({
        where: {
            fieldNo: 63,
            isActive: true,
            filterEdgeType: null,
        },
        data: {
            filterEdgeType: 'DIRECTOR',
        },
    });
    console.log(`[F63 graph binding]   Updated ${bindingUpdate.count} row(s) — filterEdgeType: null → DIRECTOR`);

    // ── 4. Verify final state ────────────────────────────────────────────────────
    console.log('\n[Verification]\n');

    const sm = await (prisma as any).sourceFieldMapping.findMany({
        where: { targetFieldNo: { in: [62, 63] } },
        select: { targetFieldNo: true, sourcePath: true, payloadSubtype: true, transformType: true, isActive: true, notes: true },
        orderBy: { targetFieldNo: 'asc' },
    });
    console.log('Source mappings F62-63:');
    sm.forEach((r: any) => console.log(`  F${r.targetFieldNo}: path=${r.sourcePath} subtype=${r.payloadSubtype} transform=${r.transformType} active=${r.isActive}`));

    const binding = await (prisma as any).masterFieldGraphBinding.findFirst({
        where: { fieldNo: 63, isActive: true },
        select: { fieldNo: true, graphNodeType: true, filterEdgeType: true, filterActiveOnly: true, writeBackEdgeType: true },
    });
    console.log('\nGraph binding F63:');
    console.log(`  ${JSON.stringify(binding)}`);

    console.log('\n[seed-directors-wiring] Done.');
}

main()
    .catch(e => { console.error('[seed-directors-wiring] ERROR:', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
