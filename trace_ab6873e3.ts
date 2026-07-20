import { PrismaClient } from '@prisma/client';
import { resolveQuestionnaireContext } from './src/lib/kyc/engagement-context';
const prisma = new PrismaClient();

async function run() {
  const q = await prisma.question.findUnique({
      where: { id: "ab6873e3-e769-4971-acae-eaa47e08c5ec" }
  });
  console.log(q);
  const ctx = await resolveQuestionnaireContext(q!.questionnaireId);
  console.log("ctx:", ctx);
}
run().finally(() => prisma.$disconnect());
