import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const masterField = await prisma.masterFieldDefinition.findUnique({
    where: { fieldNo: 63 }
  });
  console.log("MasterFieldDefinition 63:", masterField);
}

main().finally(() => prisma.$disconnect());
