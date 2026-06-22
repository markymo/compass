import { PrismaClient } from '@prisma/client';
process.env.DATABASE_URL = "postgresql://neondb_owner:npg_Te3IojQr6DXL@ep-silent-flower-abi2jpdp.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const prisma = new PrismaClient();

async function main() {
    const def = await prisma.masterFieldDefinition.findUnique({
        where: { fieldNo: 78 }
    });
    console.log("Field 78:", def);
}
main().catch(console.error).finally(() => prisma.$disconnect());
