import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    try {
        const questions = await prisma.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name='Question' AND column_name='masterFieldProjectionPath';`;
        console.log("Column exists:", (questions as any[]).length > 0);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
