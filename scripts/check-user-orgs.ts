
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const user = await prisma.user.findUnique({
        where: { email: 'mark@30gram6.com' },
        include: { memberships: true }
    });

    const orgs = await prisma.organization.findMany({
        where: {
            name: { in: ['Rabobank', 'G-SIB Bank'] }
        }
    });

    console.log('--- User Data ---');
    if (user) {
        console.log(`User ID: ${user.id}`);
        console.log('Current Memberships:');
        user.memberships.forEach(m => console.log(` - Org ID: ${m.organizationId}, Role: ${m.role}`));
    } else {
        console.log('User mark@30gram6.com not found.');
    }

    console.log('\n--- Target Organizations ---');
    orgs.forEach(o => {
        console.log(`Org: ${o.name} (ID: ${o.id})`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
