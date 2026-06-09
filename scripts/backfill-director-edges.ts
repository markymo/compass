#!/usr/bin/env tsx
/**
 * scripts/backfill-director-edges.ts
 *
 * One-time backfill: creates missing ClientLEGraphEdge rows for field 63
 * (List of company directors) where a FieldClaim has a valuePersonId or
 * valueLeId but no corresponding DIRECTOR edge exists.
 *
 * Run with:
 *   npx tsx scripts/backfill-director-edges.ts
 *
 * Safety:
 *   - DRY-RUN by default. Pass --execute to write to the DB.
 *   - All upserts use the unique index (fromNodeId, toNodeId, edgeType)
 *     so running twice is idempotent.
 *   - isActive is derived from effectiveTo: null/future = active.
 *   - Edges are tagged with source='SYSTEM_BACKFILL' for auditability.
 *
 * Scope:
 *   - fieldNo = 63 only.
 *   - Processes all ClientLEs — filter by clientLEId if needed.
 *   - Creates DIRECTOR edges for person nodes.
 *   - Creates DIRECTOR edges for legal-entity nodes (corporate directors).
 *
 * Expected output (dry run):
 *   [DRY RUN] Would create edge: DIRECTOR | clientLE=<id> | fromNode=<id> | toNode=<root>
 *
 * Expected output (--execute):
 *   [CREATED] edge: DIRECTOR | clientLE=<id> | fromNode=<id> | toNode=<root>
 *   [SKIPPED] edge already exists: DIRECTOR | clientLE=<id> | fromNode=<id>
 */

import prisma from '../src/lib/prisma';

const DRY_RUN = !process.argv.includes('--execute');
const FIELD_NO = 63;
const EDGE_TYPE = 'DIRECTOR';
const BACKFILL_SOURCE = 'SYSTEM_BACKFILL';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function resolveRootNode(clientLEId: string): Promise<{ id: string } | null> {
    const clientLE = await prisma.clientLE.findUnique({ where: { id: clientLEId } });
    if (!clientLE?.legalEntityId) return null;

    let rootNode = await prisma.clientLEGraphNode.findFirst({
        where: { clientLEId, legalEntityId: clientLE.legalEntityId },
    });
    if (!rootNode && !DRY_RUN) {
        rootNode = await prisma.clientLEGraphNode.create({
            data: {
                clientLEId,
                nodeType: 'LEGAL_ENTITY',
                legalEntityId: clientLE.legalEntityId,
                source: 'SYSTEM',
            },
        });
    }
    return rootNode;
}

async function resolveGraphNode(
    clientLEId: string,
    valuePersonId: string | null,
    valueLeId: string | null
): Promise<{ id: string } | null> {
    if (valuePersonId) {
        return prisma.clientLEGraphNode.findFirst({
            where: { clientLEId, personId: valuePersonId },
        });
    }
    if (valueLeId) {
        return prisma.clientLEGraphNode.findFirst({
            where: { clientLEId, legalEntityId: valueLeId },
        });
    }
    return null;
}

function isActive(effectiveTo: Date | null | undefined): boolean {
    if (!effectiveTo) return true;
    return effectiveTo > new Date();
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    console.log(`\n=== Director Edge Backfill ===`);
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN (pass --execute to apply)' : '*** EXECUTE MODE ***'}`);
    console.log(`Field: ${FIELD_NO} (${EDGE_TYPE})\n`);

    // 1. Find all field 63 claims with a valuePersonId or valueLeId
    //    FieldClaim has no clientLEId column — we join via subjectLeId → LegalEntity → ClientLE.
    const rawClaims = await prisma.fieldClaim.findMany({
        where: {
            fieldNo: FIELD_NO,
            subjectLeId: { not: null },
            OR: [
                { valuePersonId: { not: null } },
                { valueLeId: { not: null } },
            ],
        },
        select: {
            id: true,
            subjectLeId: true,
            valuePersonId: true,
            valueLeId: true,
            effectiveTo: true,
        },
        orderBy: { assertedAt: 'asc' },
    });

    console.log(`Found ${rawClaims.length} raw field ${FIELD_NO} claims with node references.`);

    // 2. Resolve subjectLeId → clientLEId (via ClientLE.legalEntityId)
    //    Build a map of legalEntityId → clientLEId for fast lookup.
    const clientLEs = await prisma.clientLE.findMany({
        select: { id: true, legalEntityId: true },
        where: { legalEntityId: { not: null } },
    });
    const leIdToClientLEId = new Map<string, string>(
        clientLEs
            .filter((c: any) => c.legalEntityId)
            .map((c: any) => [c.legalEntityId as string, c.id])
    );

    // 3. Map to enriched claims, filtering out those with no ClientLE
    const claims = rawClaims
        .map((c: any) => ({
            ...c,
            clientLEId: c.subjectLeId ? leIdToClientLEId.get(c.subjectLeId) ?? null : null,
        }))
        .filter((c: any) => c.clientLEId !== null);

    console.log(`Resolved ${claims.length} claims to ClientLEs (${rawClaims.length - claims.length} had no matching ClientLE).\n`);


    let created = 0;
    let skipped = 0;
    let errored = 0;
    let noNode  = 0;
    let noRoot  = 0;

    for (const claim of claims) {
        if (!claim.clientLEId) { skipped++; continue; }

        try {
            const rootNode = await resolveRootNode(claim.clientLEId);
            if (!rootNode) {
                console.warn(`  [NO ROOT] clientLE=${claim.clientLEId} — skipping`);
                noRoot++;
                continue;
            }

            const graphNode = await resolveGraphNode(
                claim.clientLEId,
                claim.valuePersonId,
                claim.valueLeId
            );
            if (!graphNode) {
                console.warn(`  [NO NODE] claim=${claim.id} person=${claim.valuePersonId} le=${claim.valueLeId} — no graph node found, skipping`);
                noNode++;
                continue;
            }

            // Check if edge already exists
            const existingEdge = await (prisma as any).clientLEGraphEdge.findFirst({
                where: {
                    clientLEId: claim.clientLEId,
                    fromNodeId: graphNode.id,
                    toNodeId: rootNode.id,
                    edgeType: EDGE_TYPE,
                },
            });

            const edgeActive = isActive(claim.effectiveTo);

            if (existingEdge) {
                console.log(`  [SKIPPED] edge exists: ${EDGE_TYPE} | clientLE=${claim.clientLEId} | from=${graphNode.id}`);
                skipped++;
            } else if (DRY_RUN) {
                console.log(`  [DRY RUN] Would create: ${EDGE_TYPE} | clientLE=${claim.clientLEId} | from=${graphNode.id} | to=${rootNode.id} | active=${edgeActive}`);
                created++;
            } else {
                await (prisma as any).clientLEGraphEdge.upsert({
                    where: {
                        fromNodeId_toNodeId_edgeType: {
                            fromNodeId: graphNode.id,
                            toNodeId: rootNode.id,
                            edgeType: EDGE_TYPE,
                        },
                    },
                    update: {
                        isActive: edgeActive,
                        source: BACKFILL_SOURCE,
                        updatedAt: new Date(),
                    },
                    create: {
                        clientLEId: claim.clientLEId,
                        fromNodeId: graphNode.id,
                        toNodeId: rootNode.id,
                        edgeType: EDGE_TYPE,
                        isActive: edgeActive,
                        source: BACKFILL_SOURCE,
                    },
                });
                console.log(`  [CREATED] ${EDGE_TYPE} | clientLE=${claim.clientLEId} | from=${graphNode.id} | to=${rootNode.id} | active=${edgeActive}`);
                created++;
            }
        } catch (err: any) {
            console.error(`  [ERROR] claim=${claim.id}: ${err.message}`);
            errored++;
        }
    }

    console.log(`\n=== Summary ===`);
    console.log(`  ${DRY_RUN ? 'Would create' : 'Created'}:  ${created}`);
    console.log(`  Skipped (exists): ${skipped}`);
    console.log(`  No graph node:    ${noNode}`);
    console.log(`  No root node:     ${noRoot}`);
    console.log(`  Errors:           ${errored}`);
    if (DRY_RUN) {
        console.log(`\n  Re-run with --execute to apply changes.\n`);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
