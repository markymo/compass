import { PrismaClient } from '@prisma/client';
import { resolveExportAnswer } from './src/lib/export/export-answer-resolver';
import { resolveQuestionnaireContext } from './src/lib/kyc/engagement-context';
const prisma = new PrismaClient();

async function run() {
  const q = await prisma.question.findUnique({
      where: { id: "4c3e3084-fefd-4c0a-8373-246834acad97" },
      include: { questionnaire: true }
  });
  
  if (!q) return;
  
  // Simulate RELEASED
  q.status = 'RELEASED';
  // Suppose it was released a week ago
  q.releasedAt = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); 
  
  const ctx = await resolveQuestionnaireContext(q.questionnaireId);
  const resolvedAnswer = await resolveExportAnswer(q, ctx?.subjectLeId, ctx?.ownerScopeId || undefined, ctx?.clientLeId);
  console.log(`Exported as: "${resolvedAnswer.displayValue}"`);
}

run().finally(() => prisma.$disconnect());
