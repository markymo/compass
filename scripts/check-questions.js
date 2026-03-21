
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const qId = '6bbc90e8-5643-400f-a1a2-96963541280f';
    const questions = await prisma.question.findMany({
        where: { questionnaireId: qId },
        select: { text: true, masterFieldNo: true }
    });
    console.log(JSON.stringify(questions, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
