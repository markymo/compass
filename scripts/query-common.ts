import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
    const q = await prisma.questionnaire.findUnique({
        where: { id: "3a74398e-69e0-4781-8173-dfa009feaf03" },
        select: { id: true, kind: true, referenceCode: true, name: true, commonForClients: { select: { id: true, shortCode: true } }, sourceId: true }
    });
    console.log(JSON.stringify(q, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
