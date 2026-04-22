import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const runs = await (prisma as any).enrichmentRun?.findMany({
    where: { legalEntityId: '3f3b592b-20e3-46c8-9eb1-9af01958f99f' },
    orderBy: { createdAt: 'desc' },
    take: 3
  });
  console.log("Runs:", JSON.stringify(runs, null, 2));

  const fetches = await prisma.registryFetch.findMany({
    orderBy: { createdAt: 'desc' },
    take: 3
  });
  console.log("Fetches:", JSON.stringify(fetches, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
