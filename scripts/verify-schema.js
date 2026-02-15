
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        // Try to find a question and check if we can select 'masterFieldNo'
        const q = await prisma.question.findFirst({
            select: { id: true, masterFieldNo: true }
        });
        console.log("Successfully selected masterFieldNo:", q);
    } catch (e) {
        console.error("Error selecting masterFieldNo:", e.message);
        process.exit(1);
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
