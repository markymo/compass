#!/usr/bin/env npx tsx
/**
 * backfill-graph-edge-toNodeId.ts
 *
 * One-time backfill: set toNodeId on ClientLEGraphEdge rows where toNodeId IS NULL.
 *
 * Root cause: FieldClaimService.writeBackGraphEdge() previously stored edges with
 * toNodeId = null. The correct value is the root LEGAL_ENTITY ClientLEGraphNode for
 * the edge's clientLEId.
 *
 * Safety:
 * - Reads edges WHERE toNodeId IS NULL only
 * - For each, resolves the root LEGAL_ENTITY node from the same clientLEId
 * - If found, updates toNodeId; if not found, logs and skips
 * - Idempotent: running twice is safe — after the first run, toNodeId IS NOT NULL
 *   so those rows are excluded from the WHERE clause
 *
 * Usage:
 *   npx tsx scripts/backfill-graph-edge-toNodeId.ts [--dry-run]
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const isDryRun = process.argv.includes('--dry-run');

async function main() {
    console.log(`[backfill] Starting graph edge toNodeId backfill — ${isDryRun ? 'DRY RUN' : 'LIVE'}`);

    // 1. Find all null-toNodeId edges
    const nullEdges = await (prisma as any).clientLEGraphEdge.findMany({
        where: { toNodeId: null },
        select: { id: true, clientLEId: true, fromNodeId: true, edgeType: true, isActive: true },
    });

    console.log(`[backfill] Found ${nullEdges.length} edge(s) with toNodeId = null`);

    if (nullEdges.length === 0) {
        console.log('[backfill] Nothing to do.');
        return;
    }

    // 2. Group by clientLEId to minimise DB round-trips for root node resolution
    const clientLEIds = [...new Set(nullEdges.map((e: any) => e.clientLEId))];
    console.log(`[backfill] Unique clientLEIds: ${clientLEIds.length}`);

    // 3. Build clientLEId → rootNodeId map
    const rootNodeMap = new Map<string, string | null>();
    for (const clientLEId of clientLEIds) {
        const clientLE = await prisma.clientLE.findUnique({
            where: { id: clientLEId },
            select: { legalEntityId: true },
        });
        if (!clientLE?.legalEntityId) {
            console.warn(`  [!] clientLE=${clientLEId} has no legalEntityId — skipping its edges`);
            rootNodeMap.set(clientLEId, null);
            continue;
        }
        const rootNode = await (prisma as any).clientLEGraphNode.findFirst({
            where: { clientLEId, legalEntityId: clientLE.legalEntityId },
            select: { id: true },
        });
        if (!rootNode) {
            console.warn(`  [!] clientLE=${clientLEId} has no root LEGAL_ENTITY graph node — skipping its edges`);
            rootNodeMap.set(clientLEId, null);
            continue;
        }
        console.log(`  [✓] clientLE=${clientLEId} → rootNode=${rootNode.id}`);
        rootNodeMap.set(clientLEId, rootNode.id);
    }

    // 4. Update each edge
    let updated = 0;
    let skipped = 0;

    for (const edge of nullEdges) {
        const rootNodeId = rootNodeMap.get(edge.clientLEId);
        if (!rootNodeId) {
            console.log(`  [skip] edge=${edge.id} (${edge.edgeType}) — no root node resolved for clientLE=${edge.clientLEId}`);
            skipped++;
            continue;
        }

        // Check whether a correctly-pointed edge already exists for this (fromNodeId, edgeType)
        const correctEdge = await (prisma as any).clientLEGraphEdge.findFirst({
            where: { fromNodeId: edge.fromNodeId, edgeType: edge.edgeType, toNodeId: rootNodeId },
            select: { id: true },
        });

        if (isDryRun) {
            if (correctEdge) {
                console.log(`  [dry-run] Would DELETE duplicate null edge=${edge.id} (${edge.edgeType}) — correct edge=${correctEdge.id} already exists`);
            } else {
                console.log(`  [dry-run] Would UPDATE edge=${edge.id} (${edge.edgeType}) toNodeId=${rootNodeId}`);
            }
        } else {
            if (correctEdge) {
                // Duplicate: the correctly-pointed edge takes precedence, delete the null one
                await (prisma as any).clientLEGraphEdge.delete({ where: { id: edge.id } });
                console.log(`  [✓] Deleted duplicate null edge=${edge.id} (${edge.edgeType}) — correct edge=${correctEdge.id} kept`);
            } else {
                await (prisma as any).clientLEGraphEdge.update({
                    where: { id: edge.id },
                    data: { toNodeId: rootNodeId },
                });
                console.log(`  [✓] Updated edge=${edge.id} (${edge.edgeType}) toNodeId=${rootNodeId}`);
            }
        }
        updated++;
    }


    console.log(`\n[backfill] Done. Updated: ${updated}  Skipped: ${skipped}  Total: ${nullEdges.length}`);
    if (isDryRun) {
        console.log('[backfill] DRY RUN — no changes written. Re-run without --dry-run to apply.');
    }
}

main()
    .catch((e) => {
        console.error('[backfill] Fatal error:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
