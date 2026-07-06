const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const q = await prisma.questionnaire.findMany({
        where: {
            commonForClients: { some: { id: '3f3b592b-20e3-46c8-9eb1-9af01958f99f' } }
        },
        select: { id: true, name: true, isDeleted: true, status: true, kind: true }
    });
    console.log("common Qs in DB:", q);
}
main().finally(() => prisma.$disconnect());
