
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const orgs = await prisma.organization.findMany({ include: { members: { include: { user: true } } } });
  console.log('Organizations:', JSON.stringify(orgs, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());

