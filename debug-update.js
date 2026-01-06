
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testUpdate() {
    const leId = '8f522269-ec1a-4fad-a717-1d276fcc0b8d';
    console.log(`Updating ${leId}...`);
    try {
        const res = await prisma.clientLE.update({
            where: { id: leId },
            data: { description: "Debug Update " + new Date().toISOString() }
        });
        console.log("SUCCESS:", JSON.stringify(res, null, 2));
    } catch (e) {
        console.error("FAIL:", e);
    } finally {
        await prisma.$disconnect();
    }
}

testUpdate();
