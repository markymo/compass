const { getFullMasterData } = require("./src/actions/client-le.ts");
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const le = await prisma.clientLE.findFirst();
  const data = await getFullMasterData(le.id);
  console.log(JSON.stringify(data.data[148], null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
