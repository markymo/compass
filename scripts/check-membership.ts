import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAllUsers() {
    try {
        // Get all users
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                name: true
            }
        });

        console.log('All users in database:');
        for (const user of users) {
            console.log(`  - ${user.email} (${user.name || 'No name'})`);
        }

        // Check Acme Hedge Fund organization
        console.log('\n--- Acme Hedge Fund Organization ---');
        const acmeOrg = await prisma.organization.findFirst({
            where: {
                name: 'Acme Hedge Fund'
            },
            include: {
                memberships: {
                    include: {
                        user: true
                    }
                }
            }
        });

        if (acmeOrg) {
            console.log(`Organization ID: ${acmeOrg.id}`);
            console.log(`Types: ${acmeOrg.types.join(', ')}`);
            console.log(`Status: ${acmeOrg.status}`);
            console.log('\nMemberships:');
            for (const m of acmeOrg.memberships) {
                console.log(`  - ${m.user.email}: ${m.role}`);
            }
        } else {
            console.log('Acme Hedge Fund organization not found');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkAllUsers();
