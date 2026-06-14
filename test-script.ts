import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const refs = await prisma.registryReference.findMany({
    take: 5,
    include: { authority: true }
  });
  console.log(JSON.stringify(refs, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
