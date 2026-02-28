
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const le = await prisma.clientLE.findFirst({
        where: { legalEntityId: { not: null } },
        select: { legalEntityId: true, name: true }
    });
    console.log(JSON.stringify(le));
    await prisma.$disconnect();
}

main();
