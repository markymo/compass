
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Find a questionnaire that has extractedContent
    const q = await prisma.questionnaire.findFirst({
        where: {
            extractedContent: {
                not: null
            }
        }
    });

    if (!q) {
        console.log("No questionnaire with extractedContent found.");
        return;
    }

    console.log(`Found Questionnaire: ${q.name} (${q.id})`);
    console.log(`Extracted Content Type: ${typeof q.extractedContent}`);

    if (Array.isArray(q.extractedContent)) {
        console.log(`Extracted Content is an array with ${q.extractedContent.length} items.`);
        console.log("First 3 items:");
        console.log(JSON.stringify(q.extractedContent.slice(0, 3), null, 2));
    } else {
        console.log("Extracted Content structure:", JSON.stringify(q.extractedContent, null, 2));
    }
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
