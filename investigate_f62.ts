import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const legalEntity = await prisma.legalEntity.findFirst({
    where: { 
      reference: { contains: '984500BFCB566D38DU72', mode: 'insensitive' }
    },
    include: { clientLEs: true }
  });

  if (!legalEntity) {
    console.error('LegalEntity not found');
    const les = await prisma.legalEntity.findMany({ take: 5, select: { reference: true, id: true } });
    console.log(les);
    
    // what about just finding a ClientLE with gleifData containing it?
    const gleif = await prisma.clientLE.findFirst({
      where: {
        gleifData: { path: ['lei'], equals: '984500BFCB566D38DU72' }
      }
    });
    console.log('Or by gleifData:', gleif?.id);
    
    return;
  }
  
  if (!legalEntity.clientLEs.length) {
     console.log(`Found LegalEntity: ${legalEntity.id} but no ClientLEs`);
     return;
  }

  const le = legalEntity.clientLEs[0];
  console.log(`Found LegalEntity: ${legalEntity.id}`);
  console.log(`Found ClientLE: ${le.id} (name: ${le.name})`);

  const claims = await prisma.fieldClaim.findMany({
    where: {
      subjectLeId: le.id,
      fieldNo: { in: [20, 62, 63] }
    },
    orderBy: { assertedAt: 'asc' }
  });

  console.log(`Found ${claims.length} claims for Fields 20, 62, 63`);
  for (const claim of claims) {
    console.log(JSON.stringify({
      id: claim.id,
      fieldNo: claim.fieldNo,
      collectionId: claim.collectionId,
      instanceId: claim.instanceId,
      claimRole: claim.claimRole,
      status: claim.status,
      sourceType: claim.sourceType,
      sourceReference: claim.sourceReference,
      assertedAt: claim.assertedAt,
      valueJson: claim.valueJson,
      valueText: claim.valueText,
      valuePersonId: claim.valuePersonId,
      valueLeId: claim.valueLeId,
      valueOrgId: claim.valueOrgId,
      effectiveFrom: claim.effectiveFrom,
      effectiveTo: claim.effectiveTo,
      tombstoneState: claim.status === 'TOMBSTONED' ? 'TOMBSTONED' : 'ACTIVE'
    }, null, 2));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
