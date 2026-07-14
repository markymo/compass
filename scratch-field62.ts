import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkField62() {
  const fields = await prisma.fieldClaim.findMany({
    where: { fieldNo: 62 },
    take: 10,
    orderBy: { assertedAt: 'desc' }
  });
  
  for (const field of fields) {
    console.log(`ID: ${field.id}, LE: ${field.subjectLeId}, Source: ${field.sourceType}`);
    console.log(`Value: ${JSON.stringify(field.valueJson, null, 2)}`);
    console.log("----");
  }
}

checkField62().catch(console.error).finally(() => prisma.$disconnect());
