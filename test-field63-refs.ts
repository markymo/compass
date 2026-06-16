import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const claims = await prisma.fieldClaim.findMany({
        where: { fieldNo: 63, sourceType: 'USER_INPUT' },
        orderBy: { assertedAt: 'desc' },
        take: 5
    });
    console.log("Recent USER_INPUT claims for Field 63:");
    console.log(JSON.stringify(claims, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
