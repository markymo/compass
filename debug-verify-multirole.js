
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Starting Multi-Role Verification...");

    const uniqueName = `MultiRole Test ${Date.now()}`;

    // 1. Create Organization with Dual Roles
    console.log("1. Creating Organization with types=['CLIENT', 'FI']...");
    const org = await prisma.organization.create({
        data: {
            name: uniqueName,
            types: ["CLIENT", "FI"]
        }
    });
    console.log("Created Org:", org);

    if (!org.types.includes("CLIENT") || !org.types.includes("FI")) {
        console.error("FAILED: Org types do not match input.");
        process.exit(1);
    }

    // 2. Query by FI Type
    console.log("2. Querying by types: { has: 'FI' }...");
    const fis = await prisma.organization.findMany({
        where: {
            name: uniqueName,
            types: { has: "FI" }
        }
    });
    console.log(`Found ${fis.length} FIs matching name.`);
    if (fis.length !== 1) {
        console.error("FAILED: Could not find org by FI type.");
        process.exit(1);
    }

    // 3. Query by CLIENT Type
    console.log("3. Querying by types: { has: 'CLIENT' }...");
    const clients = await prisma.organization.findMany({
        where: {
            name: uniqueName,
            types: { has: "CLIENT" }
        }
    });
    console.log(`Found ${clients.length} Clients matching name.`);
    if (clients.length !== 1) {
        console.error("FAILED: Could not find org by CLIENT type.");
        process.exit(1);
    }

    // Cleanup
    console.log("Cleaning up...");
    await prisma.organization.delete({ where: { id: org.id } });
    console.log("Verified Successfully.");
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
