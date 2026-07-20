import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const claims = await prisma.fieldClaim.findMany({
      where: { fieldNo: 138 }
  });
  
  for (const c of claims) {
      if (c.valueJson && !(c.valueJson as any).addressLines && !(c.valueJson as any).ccAddressId) {
          console.log(`NON-CANONICAL Claim ${c.id}:`, JSON.stringify(c.valueJson));
      }
  }
}
run().finally(() => prisma.$disconnect());
