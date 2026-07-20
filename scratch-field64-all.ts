import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const mappings = await prisma.sourceFieldMapping.findMany({
        where: { targetFieldNo: 64 }
    });
    console.log(JSON.stringify(mappings.map(m => ({
        sourceReference: m.sourceReference,
        transformConfig: m.transformConfig
    })), null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
