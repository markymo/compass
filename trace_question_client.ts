import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const qs = await prisma.question.findMany({
    where: { masterFieldNo: 138 },
    include: { questionnaire: { include: { fiEngagement: true } } }
  });
  console.log(`Found ${qs.length} questions mapped to Field 138.`);
  for (const q of qs) {
      const clientLeId = q.questionnaire?.fiEngagement?.clientLEId;
      console.log(`\nQuestion ${q.id} (Client: ${clientLeId})`);
      if (clientLeId) {
          const claims = await prisma.fieldClaim.findMany({
              where: { fieldNo: 138, subjectLeId: clientLeId }
          });
          console.log(`  -> Found ${claims.length} claims in Master Record for this client.`);
      }
  }
}
run().finally(() => prisma.$disconnect());
