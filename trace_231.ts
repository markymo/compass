import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const subjectLeId = "285f5647-a122-469c-b916-274226f4b586";
  const claims = await prisma.fieldClaim.findMany({
      where: { subjectLeId, fieldNo: { in: [138, 231] } }
  });
  console.log(`Claims for ${subjectLeId}:`);
  for (const c of claims) {
      console.log(`  Field ${c.fieldNo} - Status: ${c.status}`);
  }
}
run().finally(() => prisma.$disconnect());
