import { PrismaClient } from '@prisma/client';
import { KycStateService } from './src/lib/kyc/KycStateService';
const prisma = new PrismaClient();

async function run() {
  const claims = await prisma.fieldClaim.findMany({
      where: { fieldNo: 138 }
  });
  
  const assertedOnlyClients = new Set<string>();
  const clientToClaims = new Map<string, any[]>();
  for (const c of claims) {
      if (!c.subjectLeId) continue;
      if (!clientToClaims.has(c.subjectLeId)) clientToClaims.set(c.subjectLeId, []);
      clientToClaims.get(c.subjectLeId)!.push(c);
  }
  
  for (const [subjectLeId, list] of clientToClaims.entries()) {
      const hasVerified = list.some(c => c.status === 'VERIFIED');
      if (!hasVerified) {
          assertedOnlyClients.add(subjectLeId);
      }
  }
  
  console.log(`Clients with ONLY ASSERTED claims for Field 138:`, Array.from(assertedOnlyClients));
  
  if (assertedOnlyClients.size > 0) {
      const subjectLeId = Array.from(assertedOnlyClients)[0];
      const val = await KycStateService.getAuthoritativeValue({ subjectLeId }, 138);
      console.log(`Resolved value for ${subjectLeId}:`, val?.status, val?.value);
  }
}
run().finally(() => prisma.$disconnect());
