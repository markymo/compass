
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const userId = 'user_36i0omTdR3K7bdswkf3fn2MHaQE';
    const orgIds = [
        'e44b26a8-1c27-4308-89cf-886fc96cc889', // G-SIB Bank
        'f3bc1f3f-940f-44a2-99be-a1978dcad88c'  // Rabobank
    ];

    console.log('--- Granting ORG_ADMIN Access ---');
    for (const orgId of orgIds) {
        try {
            const existing = await prisma.membership.findFirst({
                where: {
                    userId: userId,
                    organizationId: orgId,
                    clientLEId: null
                }
            });

            if (existing) {
                await prisma.membership.update({
                    where: { id: existing.id },
                    data: { role: 'ORG_ADMIN' }
                });
                console.log(`Updated existing membership to ORG_ADMIN for Org ID: ${orgId}`);
            } else {
                await prisma.membership.create({
                    data: {
                        userId: userId,
                        organizationId: orgId,
                        role: 'ORG_ADMIN'
                    }
                });
                console.log(`Created new ORG_ADMIN membership for Org ID: ${orgId}`);
            }
        } catch (e: any) {
            console.error(`Failed to grant access for Org ID ${orgId}: ${e.message}`);
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
