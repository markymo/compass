import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const def = await prisma.masterFieldDefinition.findUnique({
        where: { fieldNo: 63 }
    });
    console.log("Field 63 def:");
    console.log(def);
}

main().catch(console.error).finally(() => prisma.$disconnect());
