import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("Backfilling master field domains to ['Onboarding']...");
    
    // Using simple updateMany to set the array value for all existing rows
    const result = await prisma.masterFieldDefinition.updateMany({
        data: {
            domain: ["Onboarding"]
        }
    });
    
    console.log(`Success! Updated ${result.count} fields with the 'Onboarding' domain.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
