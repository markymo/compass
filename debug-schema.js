
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSchema() {
    const all = await prisma.masterSchema.findMany();
    console.log("Total Schema Records:", all.length);
    const active = await prisma.masterSchema.findFirst({ where: { isActive: true } });
    console.log("Active Schema:", active ? "YES (ID: " + active.id + ")" : "NO");
    if (active) {
        console.log("Active Definition Categories:", JSON.stringify(active.definition.categories ? "Existent" : "Missing"));
    }
}

checkSchema()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
