
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const leId = "b317e132-6376-4dc4-a450-305f84e222ed";

    console.log("=== CHECKING SECTIONS ===");
    const sections = await prisma.standingDataSection.findMany({
        where: { clientLEId: leId }
    });
    sections.forEach(s => {
        console.log(`\n[${s.category}] (${s.id})`);
        console.log("-------------------");
        console.log(s.content);
        console.log("-------------------");
    });

    console.log("\n=== CHECKING LOGS ===");
    const logs = await prisma.usageLog.findMany({
        where: { action: "AI_LEARNED" },
        orderBy: { createdAt: 'desc' },
        take: 3
    });
    console.log(JSON.stringify(logs, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
