import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Removing false migration history...");
    try {
        const res = await prisma.$executeRawUnsafe(`
            DELETE FROM _prisma_migrations 
            WHERE migration_name IN (
                '20260311123402_add_uploader_to_document',
                '20260320144246_upgrade_sorting_precision_to_float'
            )
        `);
        console.log(`Deleted ${res} false migration records.`);
    } catch (e) {
        console.error("Error removing migration history:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
