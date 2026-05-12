import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const user = await prisma.user.findFirst({ where: { email: 'mark@30gram6.com' } });
    console.log("Before update:", JSON.stringify(user?.preferences, null, 2));

    await prisma.user.update({
        where: { id: user!.id },
        data: {
            preferences: {
                homePage: {
                    collapsedTreeNodes: { 'test:1': true }
                }
            }
        }
    });

    const userAfter = await prisma.user.findFirst({ where: { email: 'mark@30gram6.com' } });
    console.log("After update:", JSON.stringify(userAfter?.preferences, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
