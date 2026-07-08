import { PrismaClient, Prisma } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
    const q = await prisma.questionnaire.findFirst({
        where: {
            mappings: { not: Prisma.AnyNull }
        },
        select: {
            id: true,
            kind: true,
            mappings: true
        }
    });
    console.log(JSON.stringify(q, null, 2));
}
run().finally(() => prisma.$disconnect());
