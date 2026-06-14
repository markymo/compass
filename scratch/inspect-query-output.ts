import { PrismaClient } from '@prisma/client';
import { getFieldDetail } from '../src/actions/kyc-query';
import { getFullMasterData } from '../src/actions/client-le';

const prisma = new PrismaClient();

async function main() {
  // 1. Find a claim for Field 63 to identify a subject LE and client LE
  const claims = await prisma.fieldClaim.findMany({
    where: {
      fieldNo: 63,
    },
    select: {
      id: true,
      valueJson: true,
      subjectLeId: true,
    },
  });

  const claim = claims.find(c => c.valueJson !== null);

  if (!claim || !claim.subjectLeId) {
    console.log('No Field 63 claim found.');
    return;
  }

  const subjectLeId = claim.subjectLeId;
  console.log(`Using subjectLeId: ${subjectLeId}`);

  // Find the client LE
  const clientLE = await prisma.clientLE.findFirst({
    where: { legalEntityId: subjectLeId },
    select: { id: true },
  });

  if (!clientLE) {
    console.log(`No client LE found for subjectLeId ${subjectLeId}`);
    return;
  }

  const clientLEId = clientLE.id;
  console.log(`Using clientLEId: ${clientLEId}`);

  // 2. Test getFieldDetail
  console.log('\n--- Testing getFieldDetail ---');
  const fieldDetail = await getFieldDetail(clientLEId, 63, 'CLIENT_LE');
  console.log(`- datatype of fieldDetail: ${typeof fieldDetail}`);
  if (fieldDetail) {
    console.log(`- datatype of fieldDetail.current: ${typeof fieldDetail.current}`);
    if (fieldDetail.current) {
      console.log(`- datatype of fieldDetail.current.value: ${typeof fieldDetail.current.value}`);
      if (Array.isArray(fieldDetail.current.value)) {
        console.log(`  - Is array of length: ${fieldDetail.current.value.length}`);
        if (fieldDetail.current.value.length > 0) {
          console.log(`  - First item type: ${typeof fieldDetail.current.value[0]}`);
          console.log(`  - First item content:`, fieldDetail.current.value[0]);
        }
      }
    }
    console.log(`- datatype of fieldDetail.rows: ${typeof fieldDetail.rows} (isArray: ${Array.isArray(fieldDetail.rows)})`);
    if (fieldDetail.rows && fieldDetail.rows.length > 0) {
      console.log(`  - First row type: ${typeof fieldDetail.rows[0]}`);
      console.log(`  - First row value type: ${typeof fieldDetail.rows[0].value}`);
      console.log(`  - First row value content:`, fieldDetail.rows[0].value);
    }
  }

  // 3. Test getFullMasterData
  console.log('\n--- Testing getFullMasterData ---');
  const fullMaster = await getFullMasterData(clientLEId);
  console.log(`- success: ${fullMaster.success}`);
  if (fullMaster.success && fullMaster.data) {
    const f63 = (fullMaster.data as any)[63];
    console.log(`- data[63] exists: ${!!f63}`);
    if (f63) {
      console.log(`- datatype of data[63].value: ${typeof f63.value} (isArray: ${Array.isArray(f63.value)})`);
      if (Array.isArray(f63.value) && f63.value.length > 0) {
        console.log(`  - First item type: ${typeof f63.value[0]}`);
        console.log(`  - First item content:`, f63.value[0]);
      }
    }
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
