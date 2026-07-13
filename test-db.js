const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const fields = await prisma.masterFieldDefinition.count();
  console.log('Fields count:', fields);
}
main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
