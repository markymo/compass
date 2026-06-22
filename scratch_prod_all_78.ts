import { PrismaClient } from '@prisma/client';
process.env.DATABASE_URL = "postgresql://neondb_owner:npg_Te3IojQr6DXL@ep-silent-flower-abi2jpdp.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const prisma = new PrismaClient();

async function main() {
    const claims = await prisma.fieldClaim.findMany({
        where: { fieldNo: 78, valueText: "61900" },
        select: { id: true, subjectLeId: true, sourceType: true, sourceReference: true }
    });
    console.log(`Found ${claims.length} claims for Field 78 with value "61900"`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
