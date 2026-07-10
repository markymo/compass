import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const types = await prisma.masterFieldDefinition.findMany({
    select: { appDataType: true },
    distinct: ['appDataType']
  });
  console.log(types.map(t => t.appDataType).join(', '));
}
main().catch(console.error).finally(() => prisma.$disconnect());
