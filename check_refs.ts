import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const les = await prisma.legalEntity.findMany({
    select: { id: true, reference: true, name: true }
  });
  console.log("Legal Entities:");
  console.table(les);
}
main().catch(console.error).finally(() => prisma.$disconnect());
