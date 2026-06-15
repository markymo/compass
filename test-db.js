const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const parties = await prisma.cCParty.findMany({ select: { createdFromClaimId: true, clientLEId: true } });
  console.log("Parties:", parties);
}
main();
