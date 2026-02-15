import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Forcing mapping of top 10 questions to Field 1 (Legal Name)...");

    // Get first 10 questions
    const questions = await prisma.question.findMany({ take: 10 });

    for (const q of questions) {
        await prisma.question.update({
            where: { id: q.id },
            data: { masterFieldNo: 1 }
        });
        console.log(`Mapped Q ${q.id} to Field 1`);
    }

    console.log("Done.");
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
