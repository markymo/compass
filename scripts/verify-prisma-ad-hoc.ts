import prisma from "../src/lib/prisma";

async function main() {
    console.log("Checking Prisma Client for Ad-Hoc Fields...");

    if ((prisma as any).customFieldDefinition) {
        console.log("✅ prisma.customFieldDefinition exists!");
        try {
            const count = await (prisma as any).customFieldDefinition.count();
            console.log(`✅ Count query successful: ${count} definitions found.`);
        } catch (e) {
            console.error("❌ Count query failed:", e);
        }
    } else {
        console.error("❌ prisma.customFieldDefinition does NOT exist on the client instance.");
        console.log("Keys on prisma:", Object.keys(prisma));
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
