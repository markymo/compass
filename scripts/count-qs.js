
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const counts = await prisma.questionnaire.groupBy({
        by: ['status'],
        _count: {
            id: true,
        },
    });
    console.log('Questionnaire counts by status:', counts);

    const allqs = await prisma.questionnaire.findMany({
        select: {
            id: true,
            name: true,
            status: true
        }
    });
    console.log('All Questionnaires:', allqs);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
