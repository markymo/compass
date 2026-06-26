import prisma from './src/lib/prisma';

async function run() {
  const mappings = await prisma.sourceFieldMapping.findMany({
    where: { sourceType: 'COMPANIES_HOUSE' }
  });
  console.log(JSON.stringify(mappings.map((m: any) => ({ targetFieldNo: m.targetFieldNo, sourcePath: m.sourcePath, transformType: m.transformType, transformConfig: m.transformConfig })), null, 2));
}

run().catch(console.error).finally(() => prisma.$disconnect());
