import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const binding = await (prisma as any).masterFieldGraphBinding.findFirst({
    where: { fieldNo: 63 }
  });
  console.log("Binding for Field 63:", binding);
}

main().finally(() => prisma.$disconnect());
