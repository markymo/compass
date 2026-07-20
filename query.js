const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const m = await prisma.sourceFieldMapping.findMany({ where: { targetFieldNo: 148 } });
  console.log(m);
}
main().catch(console.error).finally(() => prisma.$disconnect());
