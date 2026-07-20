import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const qs = await prisma.question.findMany({
    where: { masterFieldNo: 138 },
    include: { questionnaire: true }
  });
  
  for (const q of qs) {
      console.log(`Question ${q.id} (Status: ${q.status}, ReleasedAt: ${q.releasedAt})`);
      if (q.questionnaire?.fiEngagementId) {
          const eng = await prisma.fIEngagement.findUnique({
              where: { id: q.questionnaire.fiEngagementId },
              include: { clientLE: true }
          });
          console.log(`  Client: ${eng?.clientLEId}`);
      }
  }
}
run().finally(() => prisma.$disconnect());
