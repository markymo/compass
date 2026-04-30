import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const edges = await prisma.clientLEGraphEdge.findMany({ where: { toNodeId: null } });
  console.log(`Found ${edges.length} edges to fix.`);
  for (const edge of edges) {
    const le = await prisma.clientLE.findUnique({ where: { id: edge.clientLEId }});
    if (le && le.legalEntityId) {
      let rootNode = await prisma.clientLEGraphNode.findFirst({
        where: { clientLEId: edge.clientLEId, legalEntityId: le.legalEntityId }
      });
      if (!rootNode) {
        rootNode = await prisma.clientLEGraphNode.create({
          data: {
            clientLEId: edge.clientLEId,
            nodeType: 'LEGAL_ENTITY',
            legalEntityId: le.legalEntityId,
            source: 'SYSTEM'
          }
        });
      }
      await prisma.clientLEGraphEdge.update({
        where: { id: edge.id },
        data: { toNodeId: rootNode.id }
      });
      console.log(`Updated edge ${edge.id} with toNodeId ${rootNode.id}`);
    }
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
