
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Checking Questionnaire Schema...");
    try {
        // Create a dummy questionnaire to verify columns
        const q = await prisma.questionnaire.create({
            data: {
                fiOrgId: "dummy", // This will fail FK probably, but we want to see if it complains about columns first.
                // Wait, FK failure is later.
                // Let's use specific error to check.
                name: "Schema Test",
                fileName: "test.txt",
                fileType: "text/plain",
                extractedContent: [1, 2, 3] // Try to write to this column
            }
        });
        console.log("Created successfully (Unexpected for dummy ID)");
        await prisma.questionnaire.delete({ where: { id: q.id } });
    } catch (e) {
        console.log("Error:", e.message);
        if (e.message.includes("does not exist") || e.message.includes("Unknown column")) {
            console.error("COLUMN MISSING CONFIRMED");
        } else if (e.message.includes("Foreign key constraint failed")) {
            console.log("Foreign key failed - Column likely exists.");
        }
    }
}

main().finally(() => prisma.$disconnect());
