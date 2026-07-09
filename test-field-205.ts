import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
    const field = await prisma.masterFieldDefinition.findUnique({
        where: { fieldNo: 205 }
    });
    console.log("Field:", field);
    const mappings = await prisma.sourceFieldMapping.findMany({
        where: { targetFieldNo: 205, isActive: true }
    });
    console.log("Mappings:", mappings);
}
run().finally(() => prisma.$disconnect());
