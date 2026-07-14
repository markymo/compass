import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    console.log('Altering column default...');
    await prisma.$executeRawUnsafe(`ALTER TABLE "master_field_definitions" ALTER COLUMN "allowAttachments" SET DEFAULT true;`);
    console.log('Updating existing rows to true...');
    const result = await prisma.$executeRawUnsafe(`UPDATE "master_field_definitions" SET "allowAttachments" = true WHERE "allowAttachments" = false;`);
    console.log(`Updated ${result} rows.`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
