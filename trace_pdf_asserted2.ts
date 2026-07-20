import { PrismaClient } from '@prisma/client';
import { resolveExportAnswer } from './src/lib/export/export-answer-resolver';
const prisma = new PrismaClient();

async function run() {
  const subjectLeId = '8cf1a8dd-f568-4ade-8279-b448362b4ca3';
  const q = { masterFieldNo: 138, compactText: "Address", text: "Address", status: "DRAFT" };
  
  const resolvedAnswer = await resolveExportAnswer(q as any, subjectLeId, undefined, "dummy");
  console.log(`Exported as: "${resolvedAnswer.displayValue}"`);
}
run().finally(() => prisma.$disconnect());
