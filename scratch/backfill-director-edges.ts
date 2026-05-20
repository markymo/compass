/**
 * Backfill missing DIRECTOR graph edges for F63 FieldClaims.
 *
 * People added manually while the edge write-back was broken have a
 * USER_INPUT FieldClaim (visible in the grid) but no clientLEGraphEdge
 * (needed by the sidebar). This script creates the missing edges.
 *
 * Safe to re-run — it skips entries that already have an edge.
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
    console.log(`\n=== F63 DIRECTOR edge backfill (${DRY_RUN ? 'DRY RUN' : 'LIVE'}) ===\n`);

    // 1. Load the field binding
    const binding = await (prisma as any).masterFieldGraphBinding.findFirst({
        where: { fieldNo: 63, isActive: true, writeBackEdgeType: { not: null } }
    });
    if (!binding) { console.error('No active graph binding for F63'); return; }
    console.log(`Binding: writeBackEdgeType=${binding.writeBackEdgeType} isActive=${binding.writeBackIsActive}\n`);

    // 2. Find all live (non-tombstone) USER_INPUT F63 claims with a personId
    const claims = await (prisma as any).fieldClaim.findMany({
        where: {
            fieldNo: 63,
            sourceType: 'USER_INPUT',
            status: { not: 'REJECTED' },
            valuePersonId: { not: null },
            // exclude tombstones: tombstones have valueJson with { tombstone: true }
            // We can't filter on null JSON in Prisma easily; instead we filter by valuePersonId not null
            // which naturally excludes tombstones (tombstones have no valuePersonId)
        },
        select: {
            id: true,
            subjectLeId: true,
            instanceId: true,
            valuePersonId: true,
            assertedAt: true,
        }
    });

    console.log(`Found ${claims.length} USER_INPUT F63 claim(s) with valuePersonId\n`);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const claim of claims) {
        const { valuePersonId, subjectLeId } = claim;

        // Find the ClientLE for this subject LE
        const clientLE = await (prisma as any).clientLE.findFirst({
            where: { legalEntityId: subjectLeId },
            select: { id: true }
        });
        if (!clientLE) {
            console.log(`  SKIP: no ClientLE for subjectLeId=${subjectLeId}`);
            skipped++;
            continue;
        }
        const clientLEId = clientLE.id;

        // Find the graph node for this person in this LE's graph
        const graphNode = await (prisma as any).clientLEGraphNode.findFirst({
            where: { clientLEId, personId: valuePersonId },
            select: { id: true }
        });
        if (!graphNode) {
            console.log(`  SKIP: no graph node for personId=${valuePersonId} in clientLE=${clientLEId}`);
            skipped++;
            continue;
        }

        // Check if a DIRECTOR edge already exists
        const existingEdge = await (prisma as any).clientLEGraphEdge.findFirst({
            where: {
                fromNodeId: graphNode.id,
                toNodeId:   null,
                edgeType:   binding.writeBackEdgeType,
            },
            select: { id: true, isActive: true }
        });

        if (existingEdge) {
            console.log(`  OK:   personId=${valuePersonId.slice(0,8)} — edge already exists (${existingEdge.id.slice(0,8)}) active=${existingEdge.isActive}`);
            skipped++;
            continue;
        }

        // Create the missing edge
        console.log(`  ${DRY_RUN ? '[DRY]' : 'CREATE'}: personId=${valuePersonId.slice(0,8)} graphNode=${graphNode.id.slice(0,8)} → DIRECTOR edge`);
        if (!DRY_RUN) {
            try {
                const edge = await (prisma as any).clientLEGraphEdge.create({
                    data: {
                        clientLEId,
                        fromNodeId: graphNode.id,
                        toNodeId:   null,
                        edgeType:   binding.writeBackEdgeType,
                        isActive:   binding.writeBackIsActive,
                        source:     'USER_INPUT',
                    }
                });
                console.log(`         → created edge ${edge.id.slice(0,8)}`);
                created++;
            } catch (e: any) {
                console.error(`         → ❌ FAILED: ${e.message}`);
                errors++;
            }
        } else {
            created++;
        }
    }

    console.log(`\n=== Summary ===`);
    console.log(`  Edges created : ${created}${DRY_RUN ? ' (dry run — nothing written)' : ''}`);
    console.log(`  Already OK    : ${skipped}`);
    console.log(`  Errors        : ${errors}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
