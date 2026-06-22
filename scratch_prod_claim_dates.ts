import { PrismaClient } from '@prisma/client';
process.env.DATABASE_URL = "postgresql://neondb_owner:npg_Te3IojQr6DXL@ep-silent-flower-abi2jpdp.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const prisma = new PrismaClient();

async function main() {
    const claim = await prisma.fieldClaim.findUnique({
        where: { id: 'da9451b7-00f6-4b1d-a3f6-0e64b5c641f0' },
        select: { createdAt: true, updatedAt: true, assertedAt: true }
    });
    console.log(claim);
}
main().catch(console.error).finally(() => prisma.$disconnect());
