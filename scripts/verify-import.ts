
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Pick a likely candidate for ties
    const name = "Canadian Imperial Bank of Commerce";
    console.log(`Checking record for: ${name}`);

    const orgs = await prisma.organization.findMany({
        where: { name: { contains: name, mode: 'insensitive' } }
    });

    console.log(`Found ${orgs.length} matches.`);
    orgs.forEach((org: any) => {
        console.log(`- ${org.name} (ID: ${org.id})`);
        console.log(`  Metadata:`, JSON.stringify(org.metadata));
    });
}

main()
    .finally(async () => {
        await prisma.$disconnect();
    });
