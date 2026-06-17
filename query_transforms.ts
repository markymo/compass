import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const sourceMappings = await prisma.sourceFieldMapping.findMany({
    where: {
      transformType: { in: ['TO_ADDRESS_VALUE', 'TO_ADDRESS_OBJECT'] }
    }
  });
  
  console.log("=== Address Transforms ===");
  console.log(JSON.stringify(sourceMappings, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
