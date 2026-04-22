import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const mapping = await prisma.sourceFieldMapping.findMany({
    where: { targetFieldNo: 63 }
  });
  console.log("SourceFieldMapping for 63:", mapping);
}

main().finally(() => prisma.$disconnect());
