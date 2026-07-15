import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkField62Def() {
  // Let's just run a raw query since Prisma model name might not be FieldDefinition exactly
  const res = await prisma.$queryRaw`SELECT * FROM "FieldDefinition" WHERE "fieldNo" = 62`;
  console.log(res);
}

checkField62Def().catch(console.error).finally(() => prisma.$disconnect());
