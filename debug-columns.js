
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkColumns() {
    try {
        const columns = await prisma.$queryRaw`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'ClientLE'
        `;
        console.log("COLUMNS:", JSON.stringify(columns, null, 2));
    } catch (error) {
        console.error("ERROR:", error);
    } finally {
        await prisma.$disconnect();
    }
}

checkColumns();
