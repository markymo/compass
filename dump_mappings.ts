import prisma from './src/lib/prisma';
async function run() {
  const mappings = await prisma.sourceFieldMapping.findMany({
    select: { targetFieldNo: true, transformType: true, sourceType: true, sourceReference: true }
  });
  console.log(JSON.stringify(mappings.filter((m: any) => m.transformType.includes('TO_PARTY')), null, 2));
}
run();
