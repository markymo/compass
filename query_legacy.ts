import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const fields = await prisma.masterFieldDefinition.findMany({
    where: {
      fieldNo: {
        in: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
      }
    }
  });

  console.log("=== Legacy Fields ===");
  console.log(fields);

  const sourceMappings = await prisma.sourceFieldMapping.findMany({
    where: {
      targetFieldNo: { in: fields.map(f => f.fieldNo) }
    }
  });
  
  console.log("=== Source Mappings related to Legacy Fields ===");
  console.log(sourceMappings.map((sm: any) => ({
    id: sm.id,
    sourceType: sm.sourceType,
    targetFieldNo: sm.targetFieldNo,
    sourcePath: sm.sourcePath,
    transformType: sm.transformType
  })));
  
}

main().catch(console.error).finally(() => prisma.$disconnect());
