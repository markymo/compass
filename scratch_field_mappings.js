const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const mappings = await prisma.sourceFieldMapping.findMany({
    where: { sourceType: 'COMPANIES_HOUSE', sourcePath: 'OFFICERS' }
  });
  console.log(JSON.stringify(mappings.map(m => ({ targetFieldNo: m.targetFieldNo, sourcePath: m.sourcePath, transformType: m.transformType, transformConfig: m.transformConfig })), null, 2));
}

run().catch(console.error).finally(() => prisma.$disconnect());
