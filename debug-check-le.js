
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listLEs() {
    const les = await prisma.clientLE.findMany();
    console.log("ALL LE RECORDS:", JSON.stringify(les, null, 2));
    await prisma.$disconnect();
}

listLEs();
