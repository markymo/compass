import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const mappings = await prisma.sourceFieldMapping.findMany({
        where: { targetFieldNo: { in: [62, 63, 64] } }
    });
    console.log(JSON.stringify(mappings, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
