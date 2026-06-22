import { PrismaClient } from '@prisma/client';
process.env.DATABASE_URL = "postgresql://neondb_owner:npg_Te3IojQr6DXL@ep-silent-flower-abi2jpdp.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const prisma = new PrismaClient();

async function main() {
    const rules = await prisma.sourceFieldMapping.findMany({
        where: { targetFieldNo: 78 }
    });
    console.log("All Mapping rules for Field 78 in PROD:");
    console.dir(rules, { depth: null });
}
main().catch(console.error).finally(() => prisma.$disconnect());
