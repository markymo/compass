import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
    const field = await prisma.masterFieldDefinition.findUnique({
        where: { fieldNo: 252 }
    });
    console.log("Field 252 profileConfig:", field?.profileConfig);
}
run().finally(() => prisma.$disconnect());
