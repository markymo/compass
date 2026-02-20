
const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Test Distinct Count
    // Note: 'distinct' works with findMany, but to get just the count of unique names efficiently...
    const distinctNames = await prisma.questionnaire.findMany({
        distinct: ['name'],
        select: {
            name: true
        }
    });
    console.log('Unique Names Count:', distinctNames.length);

    // Test Pending Count (mappings is null)
    // For JSON fields, we use equals: Prisma.DbNull or JsonNull
    const pendingCount = await prisma.questionnaire.count({
        where: {
            mappings: {
                equals: Prisma.DbNull
            }
        }
    });
    console.log('Pending Count (mappings: DbNull):', pendingCount);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
