import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("🚀 Starting backfill of ClientLE.legalEntityId...");

    // 1. Fetch all IdentityProfiles that have both a clientLEId and a legalEntityId
    const bridges = await prisma.identityProfile.findMany({
        where: {
            clientLEId: { not: null },
            legalEntityId: { not: null },
        },
        select: {
            clientLEId: true,
            legalEntityId: true,
        },
    });

    console.log(`Found ${bridges.length} bridge records in IdentityProfile.`);

    let updatedCount = 0;
    for (const bridge of bridges) {
        if (!bridge.clientLEId || !bridge.legalEntityId) continue;

        try {
            // 2. Update the corresponding ClientLE
            await prisma.clientLE.updateMany({
                where: {
                    id: bridge.clientLEId,
                    legalEntityId: null, // Only update if not already set
                },
                data: {
                    legalEntityId: bridge.legalEntityId,
                },
            });
            updatedCount++;
        } catch (error) {
            console.error(`Failed to update ClientLE ${bridge.clientLEId}:`, error);
        }
    }

    console.log(`✅ Backfill complete. Updated ${updatedCount} ClientLE records.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
