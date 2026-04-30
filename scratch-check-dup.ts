import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const edges = await prisma.clientLEGraphEdge.findMany();
  const seen = new Set();
  for (const e of edges) {
    const key = `${e.fromNodeId}-${e.toNodeId}-${e.edgeType}`;
    if (seen.has(key)) {
      console.log('DUPLICATE:', key);
    }
    seen.add(key);
  }
  console.log('Done checking duplicates.');
}
main().catch(console.error).finally(() => prisma.$disconnect());
