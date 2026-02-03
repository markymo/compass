
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("Cleaning up old Engagement Statuses...");

    // 1. Delete all Engagements (Cascades to Queries, Activities)
    // This removes the rows causing the Enum conflict
    const e = await prisma.fIEngagement.deleteMany({});
    console.log(`Deleted ${e.count} old engagements.`);

    // 2. Delete all Questions (Cascades to Comments/Activities)
    // This removes QuestionStatus conflict
    const q = await prisma.question.deleteMany({});
    console.log(`Deleted ${q.count} questions.`);

    console.log("Cleanup Complete. You can now run 'npx prisma db push'.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
