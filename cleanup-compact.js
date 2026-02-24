const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const questions = await prisma.question.findMany();
    let count = 0;
    for (const q of questions) {
        if (q.compactText && q.compactText.length === 20 && q.text.startsWith(q.compactText)) {
            // It's a hardcoded substring!
            await prisma.question.update({
                where: { id: q.id },
                data: { compactText: null }
            });
            count++;
        }
    }
    console.log(`Cleaned up ${count} improperly truncated questions.`);
}
main().finally(() => prisma.$disconnect());
