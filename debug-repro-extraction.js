
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const mammoth = require('mammoth');

async function main() {
    const id = "ccea5de0-0771-49b7-8290-7ab0dddcce13";
    console.log(`Fetching Questionnaire ${id}...`);

    const q = await prisma.questionnaire.findUnique({ where: { id } });
    if (!q) {
        console.error("Not found");
        return;
    }
    console.log(`Found: ${q.fileName} (${q.fileType})`);
    console.log(`Content Length: ${q.fileContent ? q.fileContent.length : 0} bytes`);

    if (q.fileName.endsWith(".docx")) {
        console.log("Attempting Mammoth extraction...");
        try {
            const buffer = q.fileContent; // It's Buffer/Uint8Array
            const result = await mammoth.extractRawText({ buffer: buffer });
            console.log("Mammoth Result Length:", result.value.length);
            console.log("First 100 chars:", result.value.substring(0, 100));
        } catch (e) {
            console.error("Mammoth Failed:", e);
        }
    } else {
        console.log("Not a DOCX.");
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
