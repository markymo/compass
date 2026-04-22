import { PrismaClient } from '@prisma/client';
import { LegalEntityEnrichmentService } from './src/domain/registry/LegalEntityEnrichmentService';

const prisma = new PrismaClient();

async function main() {
  const ref = await prisma.registryReference.findFirst({
    where: { clientLEId: '3f3b592b-20e3-46c8-9eb1-9af01958f99f' }
  });
  
  if (ref) {
    console.log("Triggering enrichment refresh for:", ref.id);
    await LegalEntityEnrichmentService.refreshRegistryClaims(ref.id, { autoApply: true, initiatedBy: 'SYSTEM_FIX' });
    console.log("Done.");
  }
}

main().finally(() => prisma.$disconnect());
