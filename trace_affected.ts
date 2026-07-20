import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const claims = await prisma.fieldClaim.findMany({
      where: { fieldNo: 138, status: { in: ['VERIFIED', 'ASSERTED'] } },
  });
  console.log(`Claims for Field 138: ${claims.length}`);
  const clients = new Set(claims.map(c => c.clientLeScopeId));
  for (const c of clients) {
      if (c) {
          const qs = await prisma.questionnaire.findMany({
              where: { fiEngagement: { clientLEId: c } },
              include: { questions: { where: { masterFieldNo: 138 } } }
          });
          const mappedQuestions = qs.flatMap(q => q.questions);
          console.log(`Client ${c} has ${mappedQuestions.length} questionnaires mapped to 138`);
      }
  }
}
run().finally(() => prisma.$disconnect());
