import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const clientLEId = '3f3b592b-20e3-46c8-9eb1-9af01958f99f';

    // All PERSON graph nodes for this LE
    const nodes = await (prisma as any).clientLEGraphNode.findMany({
        where: { clientLEId, nodeType: 'PERSON' },
        include: { person: { select: { id: true, firstName: true, lastName: true } } },
    });
    console.log('\nPERSON graph nodes for this LE:');
    for (const n of nodes) {
        console.log(`  nodeId=${n.id} personId=${n.personId} name=${n.person ? n.person.firstName + ' ' + n.person.lastName : 'NULL'}`);
    }

    // All edges for this LE
    const edges = await (prisma as any).clientLEGraphEdge.findMany({
        where: { clientLEId },
        select: { id: true, fromNodeId: true, edgeType: true, isActive: true, source: true }
    });
    console.log('\nAll graph edges for this LE:');
    for (const e of edges) {
        const node = nodes.find((n: any) => n.id === e.fromNodeId);
        const name = node?.person ? node.person.firstName + ' ' + node.person.lastName : e.fromNodeId.slice(0, 8);
        console.log(`  edgeId=${e.id.slice(0,8)} fromNode=${name} type=${e.edgeType} active=${e.isActive} src=${e.source}`);
    }

    // Recent FieldClaims for F63
    const claims = await (prisma as any).fieldClaim.findMany({
        where: { fieldNo: 63 },
        orderBy: { assertedAt: 'desc' },
        take: 8,
        select: { id: true, instanceId: true, valuePersonId: true, valueLeId: true, sourceType: true, status: true, assertedAt: true }
    });
    console.log('\nRecent F63 FieldClaims (newest first):');
    for (const c of claims) {
        console.log(`  ${c.id.slice(0,8)} inst=${c.instanceId} personId=${c.valuePersonId?.slice(0,8) ?? 'null'} leId=${c.valueLeId?.slice(0,8) ?? 'null'} src=${c.sourceType} status=${c.status}`);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
