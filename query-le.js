const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const le = await prisma.clientLE.findFirst({
        where: {
            commonQuestionnaires: { some: {} }
        },
        select: { id: true, name: true }
    });
    console.log(le);
}
main().finally(() => prisma.$disconnect());
