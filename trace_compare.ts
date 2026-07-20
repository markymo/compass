import { KycStateService } from './src/lib/kyc/KycStateService';
import prisma from './src/lib/prisma';

async function run() {
  const clientLeId = "55cf4edc-d078-4313-b467-93e7fd07acd1";
  const subjectLeId = "285f5647-a122-469c-b916-274226f4b586";
  const fieldNo = 138;

  // Simulate PDF export path:
  const authVal = await KycStateService.getAuthoritativeValue(
      { subjectLeId, clientLEId: clientLeId },
      fieldNo,
      undefined,
      undefined
  );
  console.log("PDF Export gets:", authVal?.value);

  // Simulate Master Record path:
  const allFields = await KycStateService.resolveAllFields(
      { subjectLeId, clientLEId: clientLeId },
      [{ fieldNo, isMultiValue: false }]
  );
  console.log("Master Record gets:", (allFields.get(fieldNo) as any)?.value);
}

run().finally(() => prisma.$disconnect());
