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
  const questionnaireId = q.questionnaireId;
  console.log("Questionnaire ID:", questionnaireId);

  const ctx = await resolveQuestionnaireContext(questionnaireId);
  console.log("Context subjectLeId:", ctx?.subjectLeId);
  console.log("Context clientLeId:", ctx?.clientLeId);

  console.log(`\nResolving Question: ${q.id}`);
  const resolvedAnswer = await resolveExportAnswer(q, ctx?.subjectLeId, ctx?.ownerScopeId || undefined, ctx?.clientLeId);
  console.log(`Exported as: "${resolvedAnswer.displayValue}"`);
  console.log(`Answer state:`, resolvedAnswer.answerState);
  console.log(`Raw value:`, JSON.stringify(resolvedAnswer.rawValue));
}

run().finally(() => prisma.$disconnect());
