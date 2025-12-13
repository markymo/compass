
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSchema() {
    const latest = await prisma.masterSchema.findFirst({ orderBy: { version: 'desc' } });
    console.log("Latest Schema ID:", latest.id);
    console.log("Latest IsActive:", latest.isActive);
    console.log("Latest Categories:", JSON.stringify(latest.definition.categories));

    const active = await prisma.masterSchema.findFirst({ where: { isActive: true } });
    if (active && active.id !== latest.id) {
        console.log("Active Schema ID:", active.id);
        console.log("Active Categories:", JSON.stringify(active.definition.categories));
    }
}

checkSchema()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
