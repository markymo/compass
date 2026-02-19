
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const email = 'mark@30gram6.com';
    console.log(`Checking state for ${email}...`);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        console.log('User not found!');
        return;
    }
    console.log('User found:', user.id, user.name);

    const memberships = await prisma.membership.findMany({
        where: { userId: user.id },
        include: {
            organization: true,
            clientLE: true
        }
    });

    console.log(`Found ${memberships.length} memberships:`);
    memberships.forEach(m => {
        if (m.organization) {
            console.log(` - Org: ${m.organization.name} (${m.role}) [Type: ${m.organization.types}]`);
        } else if (m.clientLE) {
            console.log(` - LE: ${m.clientLE.name} (${m.role})`);
        } else {
            console.log(` - Orphan/Unknown Membership: ${JSON.stringify(m)}`);
        }
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
