import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Checking for missing columns in User table...");
    try {
        const otherCols = ['jobTitle', 'notificationPrefs', 'phone', 'preferences'];
        for (const col of otherCols) {
            const res: any = await prisma.$queryRawUnsafe(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'User' AND column_name = '${col}'
            `);
            if (res.length === 0) {
                console.log(`Column '${col}' is missing. Adding it...`);
                const type = (col === 'notificationPrefs' || col === 'preferences') ? 'JSONB' : 'TEXT';
                const defaultValue = col === 'preferences' ? "NOT NULL DEFAULT '{}'" : "";
                await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "${col}" ${type} ${defaultValue}`);
                console.log(`Column '${col}' added.`);
            } else {
                console.log(`Column '${col}' already exists.`);
            }
        }

        console.log("Database schema fix complete!");
    } catch (e) {
        console.error("Error during schema fix:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
