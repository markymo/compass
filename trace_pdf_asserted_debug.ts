import { PrismaClient } from '@prisma/client';
import { KycStateService } from './src/lib/kyc/KycStateService';
import { getFieldDetail } from './src/actions/client-le';

const prisma = new PrismaClient();

async function run() {
  const subjectLeId = '8cf1a8dd-f568-4ade-8279-b448362b4ca3';
  const entityId = 'something'; // Dummy
  
  const derived = await KycStateService.getAuthoritativeValue(
      { subjectLeId, clientLEId: entityId },
      138,
      undefined,
      undefined
  );
  
  console.log("derived:", derived);
}
run().finally(() => prisma.$disconnect());
