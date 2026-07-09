const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const count = await prisma.questionnaire.count();
    const qs = await prisma.questionnaire.findMany({ select: { id: true, name: true, isDeleted: true } });
    console.log("Questionnaires count:", count);
    console.log(qs);
}
main().catch(console.error).finally(() => prisma.$disconnect());
