
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const clientId = "d2988607-517c-4995-aa09-e733f712b059";

    // The 2 Correct LEs (Names from previous logs: Acme Fund I, LP and HORNSEA 1 LIMITED)
    const validNames = ["Acme Fund I, LP", "HORNSEA 1 LIMITED"];

    console.log("--- Cleaning up Acme Owners ---");

    // Find IDs of valid LEs
    const validLEs = await prisma.clientLE.findMany({
        where: { name: { in: validNames } }
    });
    const validIds = validLEs.map(le => le.id);

    console.log(`Keep IDs: ${validIds.join(", ")}`);

    // Find Junk Owners
    const junkOwners = await prisma.clientLEOwner.findMany({
        where: {
            partyId: clientId,
            clientLEId: { notIn: validIds }
        }
    });

    console.log(`Found ${junkOwners.length} junk links to remove.`);

    // Delete Junk Owners
    // (We use deleteMany for hard cleanup, or update endAt for soft)
    // Since I just created them as a mistake, Hard Delete is cleaner to verify state.
    const deleted = await prisma.clientLEOwner.deleteMany({
        where: {
            partyId: clientId,
            clientLEId: { notIn: validIds }
        }
    });

    console.log(`Deleted ${deleted.count} junk links.`);

    // Verify Final State
    const finalOwners = await prisma.clientLEOwner.findMany({
        where: {
            partyId: clientId,
            endAt: null
        },
        include: { clientLE: true }
    });

    console.log("\n--- Final LE List for Acme ---");
    finalOwners.forEach(o => console.log(`- ${o.clientLE.name}`));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
