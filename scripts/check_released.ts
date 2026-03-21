import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const questions = await prisma.question.findMany({
        where: { status: "RELEASED" },
        include: { questionnaire: { include: { fiEngagement: true, engagements: true } } }
    });
    console.log(JSON.stringify(questions, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
