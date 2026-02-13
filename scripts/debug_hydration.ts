
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Fetching recent ClientLEs...");

    const clientLEs = await prisma.clientLE.findMany({
        take: 5,
        orderBy: { updatedAt: 'desc' },
        include: {
            identityProfile: {
                include: {
                    legalEntity: true
                }
            }
        }
    });

    for (const le of clientLEs) {
        console.log(`\nClientLE: ${le.name} (ID: ${le.id})`);

        if (le.identityProfile) {
            console.log(`  - IdentityProfile Found (ID: ${le.identityProfile.id})`);
            console.log(`  - Legal Name (Field 3): ${le.identityProfile.legalName}`);
            console.log(`  - ClientLE ID in Profile: ${le.identityProfile.clientLEId}`);

            if (le.identityProfile.legalEntity) {
                console.log(`  - LegalEntity Linked (ID: ${le.identityProfile.legalEntity.id})`);
                console.log(`    - Ref: ${le.identityProfile.legalEntity.reference}`);
            } else {
                console.log(`  - NO LegalEntity Linked`);
            }
        } else {
            console.log(`  - NO IdentityProfile Found`);
        }
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
