
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migrate() {
    console.log("Starting ClientLE Ownership Migration (CJS)...");

    const les = await prisma.clientLE.findMany({
        where: {
            clientOrgId: { not: undefined }
        }
    });

    console.log(`Found ${les.length} Legal Entities to verify.`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const le of les) {
        if (!le.clientOrgId) continue;

        const existingOwner = await prisma.clientLEOwner.findFirst({
            where: {
                clientLEId: le.id,
                partyId: le.clientOrgId,
                endAt: null
            }
        });

        if (!existingOwner) {
            console.log(`Migrating LE: ${le.name} (${le.id}) -> Party: ${le.clientOrgId}`);

            await prisma.clientLEOwner.create({
                data: {
                    clientLEId: le.id,
                    partyId: le.clientOrgId,
                    startAt: le.createdAt,
                    endAt: null
                }
            });
            migratedCount++;
        } else {
            skippedCount++;
        }
    }

    console.log(`Migration Complete.`);
    console.log(`Migrated: ${migratedCount}`);
    console.log(`Skipped: ${skippedCount}`);
}

migrate()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
