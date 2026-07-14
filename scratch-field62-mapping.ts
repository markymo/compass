import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkField62Mapping() {
  const def = await prisma.fieldDefinition.findUnique({
    where: { fieldNo: 62 }
  });
  console.log("Field Def:");
  console.log(def);
}

checkField62Mapping().catch(console.error).finally(() => prisma.$disconnect());
