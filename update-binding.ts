import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.masterFieldGraphBinding.updateMany({
    where: { fieldNo: 63 },
    data: { writeBackEdgeType: 'DIRECTOR' }
  });
  console.log("Updated binding 63.");
}

main().finally(() => prisma.$disconnect());
