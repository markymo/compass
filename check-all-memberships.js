const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const memberships = await prisma.membership.count();
    console.log("Total memberships in DB:", memberships);
    const orgs = await prisma.organization.count();
    console.log("Total orgs in DB:", orgs);
}
main().finally(() => prisma.$disconnect());
