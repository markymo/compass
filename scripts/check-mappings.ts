import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const totalQuestions = await prisma.question.count();
    const mappedQuestions = await prisma.question.count({
        where: {
            OR: [
                { masterFieldNo: { not: null } },
                { masterQuestionGroupId: { not: null } }
            ]
        }
    });

    console.log(`Total Questions: ${totalQuestions}`);
    console.log(`Mapped Questions: ${mappedQuestions}`);

    if (mappedQuestions === 0) {
        console.log("No mapped questions found. Seeding mappings...");
        // Basic Seeding Logic
        // Map any question with "Legal Name" in text to Field 1
        const update1 = await prisma.question.updateMany({
            where: { text: { contains: 'Legal Name', mode: 'insensitive' } },
            data: { masterFieldNo: 1 }
        });
        console.log(`Mapped ${update1.count} questions to Legal Name (1)`);

        // Map "City" to Field 7 (Reg Address City)
        const update2 = await prisma.question.updateMany({
            where: { text: { contains: 'City', mode: 'insensitive' } },
            data: { masterFieldNo: 7 }
        });
        console.log(`Mapped ${update2.count} questions to City (7)`);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
