import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import { updateAccountSettings } from '../src/actions/account';

async function main() {
    // I can't easily mock next/headers for a server action. 
    // Let me just test via Prisma directly.
    const user = await prisma.user.findFirst({ where: { email: 'mark@30gram6.com' } });
    console.log("DB Prefs:", JSON.stringify(user?.preferences));
}
main().catch(console.error).finally(() => prisma.$disconnect());
