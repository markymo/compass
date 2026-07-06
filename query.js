const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const q = await prisma.questionnaire.findFirst({ where: { kind: 'WORKING_COPY', fiEngagementId: null } });
    console.log(q ? q.id : "Not found");
}
main().finally(() => prisma.$disconnect());
