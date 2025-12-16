
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAndMigrate() {
    console.log("Checking Organizations...");
    const orgs = await prisma.organization.findMany();

    for (const org of orgs) {
        if (!org.types || org.types.length === 0) {
            let newType = "CLIENT"; // Default

            // Heuristic Guessing based on Name (since 'type' column is gone)
            const nameLower = org.name.toLowerCase();
            if (nameLower.includes("system") || nameLower.includes("admin")) {
                newType = "SYSTEM";
            } else if (nameLower.includes("bank") || nameLower.includes("nat west") || nameLower.includes("ing") || nameLower.includes("goldman")) {
                newType = "FI";
            } else if (nameLower.includes("legal") || nameLower.includes("llp") || nameLower.includes("corp")) {
                newType = "CLIENT";
            }

            console.log(`Migrating ${org.name} -> [${newType}]`);
            await prisma.organization.update({
                where: { id: org.id },
                data: { types: [newType] }
            });
        }
    }
    console.log("Migration Check Complete.");
}

checkAndMigrate()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
