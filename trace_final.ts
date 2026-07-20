import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const claims = await prisma.fieldClaim.findMany({
      where: { fieldNo: 138, subjectLeId: null }
  });
  console.log(`Claims with null subjectLeId for Field 138: ${claims.length}`);
  if (claims.length > 0) {
      console.log(`Example clientLeScopeId: ${claims[0].clientLeScopeId}`);
  }
}
run().finally(() => prisma.$disconnect());
