import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const fields = await prisma.masterFieldDefinition.findMany({
        where: { allowAttachments: false }
    });
    console.log(`Fields with allowAttachments = false: ${fields.length}`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
