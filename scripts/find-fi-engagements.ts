
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const fiOrgs = await (prisma as any).organization.findMany({
        where: {
            types: {
                has: 'FI'
            }
        },
        include: {
            engagements: {
                include: {
                    clientLE: true
                }
            }
        }
    });

    console.log('--- FI/Supplier Organizations & Engagements ---');
    fiOrgs.forEach((org: any) => {
        console.log(`\nOrganization: ${org.name} (ID: ${org.id})`);
        if (org.engagements.length === 0) {
            console.log('  No engagements found.');
        } else {
            org.engagements.forEach((eng: any) => {
                console.log(`  Engagement ID: ${eng.id}`);
                console.log(`    Client LE: ${eng.clientLE.name}`);
                console.log(`    Status: ${eng.status}`);
                console.log(`    Test URL: http://localhost:3000/app/s/${org.id}/engagements/${eng.id}`);
            });
        }
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
