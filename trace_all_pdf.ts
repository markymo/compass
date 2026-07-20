import { PrismaClient } from '@prisma/client';
import { resolveExportAnswer } from './src/lib/export/export-answer-resolver';
import { resolveQuestionnaireContext } from './src/lib/kyc/engagement-context';
const prisma = new PrismaClient();

async function run() {
  const qs = await prisma.question.findMany({
      where: { masterFieldNo: 138 },
      include: { questionnaire: true }
  });
  
  for (const q of qs) {
      const ctx = await resolveQuestionnaireContext(q.questionnaireId);
      const resolvedAnswer = await resolveExportAnswer(q, ctx?.subjectLeId, ctx?.ownerScopeId || undefined, ctx?.clientLeId);
      console.log(`Question ${q.id} (Client: ${ctx?.clientLeId}, Subject: ${ctx?.subjectLeId}) -> Exported as: "${resolvedAnswer.displayValue}"`);
  }
}

run().finally(() => prisma.$disconnect());
