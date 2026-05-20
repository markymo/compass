import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const clientLEId = '3f3b592b-20e3-46c8-9eb1-9af01958f99f';
    const refPersonId = 'f5bf4672-db3b-4d16-a913-daf55f065b2d'; // Colin Fellowes

    const binding = await (prisma as any).masterFieldGraphBinding.findFirst({
        where: { fieldNo: 63, isActive: true, writeBackEdgeType: { not: null } }
    });
    console.log('binding:', JSON.stringify(binding));

    const graphNode = await (prisma as any).clientLEGraphNode.findFirst({
        where: { clientLEId, personId: refPersonId },
        select: { id: true }
    });
    console.log('graphNode:', JSON.stringify(graphNode));

    if (graphNode) {
        const existingEdge = await (prisma as any).clientLEGraphEdge.findFirst({
            where: { fromNodeId: graphNode.id, toNodeId: null, edgeType: binding.writeBackEdgeType },
            select: { id: true }
        });
        console.log('existingEdge:', existingEdge);
        try {
            let edge: any;
            if (existingEdge) {
                edge = await (prisma as any).clientLEGraphEdge.update({ where: { id: existingEdge.id }, data: { isActive: binding.writeBackIsActive, source: 'USER_INPUT' } });
            } else {
                edge = await (prisma as any).clientLEGraphEdge.create({ data: { clientLEId, fromNodeId: graphNode.id, toNodeId: null, edgeType: binding.writeBackEdgeType, isActive: binding.writeBackIsActive, source: 'USER_INPUT' } });
            }
            console.log(`✅ edge ${existingEdge ? 'updated' : 'created'}:`, edge.id, 'isActive:', edge.isActive);
        } catch (e: any) {
            console.error('❌ FAILED:', e.message);
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
