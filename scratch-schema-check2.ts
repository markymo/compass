import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const f = await prisma.fieldClaim.findFirst({
    where: { fieldNo: 62 },
    select: { sourceReference: true }
  });
  console.log("DB value:", f);
}

check().catch(console.error).finally(() => prisma.$disconnect());
