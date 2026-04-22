import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const edges = await prisma.clientLEGraphEdge.findMany({
    where: { clientLEId: '3f3b592b-20e3-46c8-9eb1-9af01958f99f' },
    select: { id: true, edgeType: true, isActive: true }
  });
  console.log("Edges:", edges);
}

main().finally(() => prisma.$disconnect());
