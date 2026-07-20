import { PrismaClient, Prisma } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const qs = await prisma.question.findMany({
    where: { masterFieldNo: 138, answer: { not: Prisma.AnyNull } },
    include: { questionnaire: { include: { fiEngagement: true } } }
  });
  console.log(`Found ${qs.length} answered questions mapped to Field 138.`);
  for (const q of qs) {
      console.log(`\nQuestion ${q.id} (Client: ${q.questionnaire?.fiEngagement?.clientLEId})`);
      console.log(`Answer:`, JSON.stringify(q.answer));
  }
}
run().finally(() => prisma.$disconnect());
