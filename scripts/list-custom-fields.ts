
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const fields = await prisma.customFieldDefinition.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10
    });

    console.log('--- LATEST 10 CUSTOM FIELDS ---');
    fields.forEach(f => {
        console.log(`[${f.createdAt.toISOString()}] ID: ${f.id} | OrgID: ${f.orgId} | Label: ${f.label} | Key: ${f.key}`);
    });

    const orgs = await prisma.organization.findMany({
        where: { id: { in: fields.map(f => f.orgId) } }
    });

    console.log('\n--- ORGS FOR THESE FIELDS ---');
    orgs.forEach(o => {
        console.log(`ID: ${o.id} | Name: ${o.name}`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
