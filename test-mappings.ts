import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
    const q = await prisma.questionnaire.findFirst({
        where: {
            questions: {
                some: { masterFieldNo: { not: null } }
            }
        },
        select: {
            id: true,
            kind: true,
            name: true,
            questions: {
                where: { masterFieldNo: { not: null } },
                take: 1,
                select: { id: true, masterFieldNo: true }
            }
        }
    });
    console.log(JSON.stringify(q, null, 2));
}
run().finally(() => prisma.$disconnect());
