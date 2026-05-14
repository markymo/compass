import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const authorities = await prisma.registryAuthority.findMany({
        where: { name: { contains: "Companies House" } }
    });
    console.log(authorities);
}
main().finally(() => prisma.$disconnect());
