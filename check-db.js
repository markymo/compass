const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const user = await prisma.user.findUnique({ where: { email: 'mark@30gram6.com' } });
    if (!user) {
        console.log("User mark@30gram6.com not found!");
        return;
    }
    console.log("User ID:", user.id);
    const memberships = await prisma.membership.findMany({
        where: { userId: user.id },
        include: { organization: true }
    });
    console.log(`Found ${memberships.length} memberships for Mark.`);
    for (const m of memberships) {
        console.log(`- Org: ${m.organization?.name} (Roles: ${m.role}) (Types: ${m.organization?.types})`);
    }
}
main().finally(() => prisma.$disconnect());
