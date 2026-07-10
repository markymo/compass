import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const fields = await prisma.masterFieldDefinition.findMany({
    select: { appDataType: true, isMultiValue: true },
    distinct: ['appDataType', 'isMultiValue']
  });
  console.log(JSON.stringify(fields, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
