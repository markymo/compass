import { PrismaClient } from '@prisma/client';
import { resolveExportAnswer } from './src/lib/export/export-answer-resolver';
const prisma = new PrismaClient();

async function run() {
  const claims = await prisma.fieldClaim.findMany({
    where: { fieldNo: 138 }
  });
  
  for (const c of claims) {
      const clientLeId = c.subjectLeId || c.clientLeScopeId;
      if (!clientLeId) continue;
      
      const q = await prisma.question.findFirst({
          where: { masterFieldNo: 138 }
      });
      if (!q) continue;

      const res = await resolveExportAnswer(q, clientLeId, c.ownerScopeId || undefined, clientLeId);
      console.log(`Claim ${c.id} (Status: ${c.status}) for Client ${clientLeId}:`);
      console.log(`  Raw value:`, JSON.stringify(res.rawValue));
      console.log(`  Exported as: "${res.displayValue}"`);
      console.log(`  Answer state: ${res.answerState}`);
      console.log(`  valueJson in DB:`, JSON.stringify(c.valueJson));
  }
}

run().finally(() => prisma.$disconnect());
