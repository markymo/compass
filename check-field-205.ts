import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
    const field = await prisma.masterFieldDefinition.findUnique({
        where: { fieldNo: 205 }
    });
    console.log("Field profileConfig:", field?.profileConfig);
}
run().finally(() => prisma.$disconnect());
