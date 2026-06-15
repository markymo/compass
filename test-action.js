const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const p = await prisma.cCParty.findMany({ where: { createdFromClaimId: { not: null } } });
  console.log("promoted:", p);
}
main();
