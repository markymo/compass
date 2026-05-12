import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const user = await prisma.user.findFirst({ where: { email: 'mark@30gram6.com' } });
    console.log("Type:", typeof user?.preferences);
    console.log("Value:", user?.preferences);
}
main().catch(console.error).finally(() => prisma.$disconnect());
