const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const questions = await prisma.question.findMany({ take: 10 });
    questions.forEach(q => {
        console.log(`Original: ${q.text.substring(0, 30)}... | Compact: ${q.compactText}`);
    });
}
main().finally(() => prisma.$disconnect());
