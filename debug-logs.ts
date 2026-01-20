
import prisma from "./src/lib/prisma";

async function main() {
    const q = await prisma.questionnaire.findFirst({
        orderBy: { updatedAt: 'desc' }
    });

    if (!q) {
        console.log("No questionnaire found.");
        return;
    }

    console.log("Questionnaire ID:", q.id);
    console.log("Status:", q.status);
    console.log("Type of processingLogs:", typeof q.processingLogs);
    console.log("Is Array?", Array.isArray(q.processingLogs));
    console.log("Content:", JSON.stringify(q.processingLogs, null, 2));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
