
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Fetching System Admins...');

    try {
        const admins = await prisma.user.findMany({
            where: {
                memberships: {
                    some: {
                        organization: {
                            types: {
                                has: "SYSTEM" // Enums are passed as strings in Prisma query arguments often, but let's check strict types if needed. 
                                // Schema says OrgType enum. Prisma Client usually accepts strings for enums in 'has'.
                            }
                        }
                    }
                }
            },
            select: {
                id: true,
                name: true,
                email: true
            }
        });

        console.log('Result:', JSON.stringify(admins, null, 2));

    } catch (e) {
        console.error('Query Failed:', e);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
