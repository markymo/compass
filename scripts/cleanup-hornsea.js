
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    const name = "Hornsea 1"; // Approximate name
    console.log(`Searching for entity like: ${name}...`);

    // Find the LE
    const le = await prisma.clientLE.findFirst({
        where: { name: { contains: name, mode: "insensitive" } },
        include: { owners: { include: { party: true } } }
    });

    if (!le) {
        console.log("Entity not found.");
        return;
    }

    console.log(`Found Entity: ${le.name} (${le.id})`);
    console.log(`Current Owners: ${le.owners.length}`);
    le.owners.forEach(o => console.log(` - ${o.party.name} (${o.partyId})`));

    // If more than 1 owner, remove the most recent one (the one added by the auto-link)
    if (le.owners.length > 1) {
        // Sort by createdAt desc to find the newest
        const owners = le.owners.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        const unwantedOwner = owners[0]; // The newest one

        console.log(`Removing unwanted owner link: ${unwantedOwner.party.name}`);

        await prisma.clientLEOwner.delete({
            where: { id: unwantedOwner.id }
        });

        console.log("Link removed.");
    } else {
        console.log("Only 1 owner found. No cleanup needed.");
    }
}

main();
