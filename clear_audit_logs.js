import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Clearing AuditLog table...");
    await prisma.$executeRawUnsafe('DELETE FROM "AuditLog"');
    console.log("Done");
}

main().catch(console.error).finally(() => prisma.$disconnect());
