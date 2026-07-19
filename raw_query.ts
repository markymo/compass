import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$queryRaw`SELECT id, lei, name FROM "ClientLE" WHERE "lei" = '984500BFCB566D38DU72' OR "gleifData"::text LIKE '%984500BFCB566D38DU72%'`;
  console.log('ClientLE raw query:', result);

  const claimsRaw = await prisma.$queryRaw`SELECT * FROM field_claims WHERE "valueJson"::text LIKE '%984500BFCB566D38DU72%' OR "valueText" LIKE '%984500BFCB566D38DU72%'`;
  console.log('FieldClaim raw query:', claimsRaw);
}

main().catch(console.error).finally(() => prisma.$disconnect());
