import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const claims = await prisma.fieldClaim.findMany({
    where: { 
      fieldNo: 63
    },
    select: { id: true, subjectLeId: true, valuePersonId: true, status: true, effectiveTo: true }
  });
  console.log("Field 63 Claims:", claims);
}

main().finally(() => prisma.$disconnect());
