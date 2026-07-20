import { PrismaClient } from '@prisma/client';
import { resolveQuestionnaireContext } from './src/lib/kyc/engagement-context';
const prisma = new PrismaClient();
async function run() {
  const ids = ["ab6873e3-e769-4971-acae-eaa47e08c5ec", "86fc9f9f-94aa-4c7c-8ec5-545392b32555"];
  
  for (const qid of ids) {
      const q = await prisma.question.findUnique({ where: { id: qid } });
      if (!q) continue;
      
      const ctx = await resolveQuestionnaireContext(q.questionnaireId);
      console.log(`Q: ${qid} -> clientLeId: ${ctx?.clientLeId}, subjectLeId: ${ctx?.subjectLeId}`);
  }
}
run().finally(() => prisma.$disconnect());
