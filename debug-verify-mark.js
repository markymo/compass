
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Checking 'mark\\'s Corp'...");
    
    // Find loose match
    const orgs = await prisma.organization.findMany({
        where: { name: { contains: "mark", mode: "insensitive" } }
    });

    console.log(`Found ${orgs.length} orgs matching 'mark':`);
    orgs.forEach(o => console.log(` - ${o.name} (${o.id}): ${JSON.stringify(o.types)}`));

    const target = orgs.find(o => o.name === "mark's Corp");
    if (target) {
        if (!target.types.includes("FI")) {
            console.log("Updating to include FI...");
            const newTypes = Array.from(new Set([...target.types, "FI", "CLIENT"])); // Ensure unique
            await prisma.organization.update({
                where: { id: target.id },
                data: { types: newTypes }
            });
            console.log("Updated successfully.");
        } else {
            console.log("Already has FI role.");
        }
    } else {
        console.log("Could not find exact match for 'mark\\'s Corp'.");
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
