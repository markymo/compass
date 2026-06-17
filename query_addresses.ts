import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const addressFields = await prisma.masterFieldDefinition.findMany({
    where: {
      appDataType: {
        in: ['ADDRESS', 'ADDRESS_REF']
      }
    }
  });

  console.log("=== ADDRESS Fields ===");
  console.log(addressFields);

  const addressClaims = await prisma.fieldClaim.count({
    where: {
      valueAddressId: { not: null }
    }
  });
  console.log("=== ADDRESS Claims Count ===", addressClaims);

  const sourceMappings = await prisma.sourceFieldMapping.findMany({
    where: {
      OR: [
        { targetFieldNo: { in: addressFields.map(f => f.fieldNo) } },
        { sourcePath: { contains: 'address' } }
      ]
    }
  });
  
  console.log("=== Source Mappings related to Address ===");
  console.log(sourceMappings.map((sm: any) => ({
    id: sm.id,
    sourceType: sm.sourceType,
    targetFieldNo: sm.targetFieldNo,
    sourcePath: sm.sourcePath,
    transformType: sm.transformType
  })));
  
}

main().catch(console.error).finally(() => prisma.$disconnect());
