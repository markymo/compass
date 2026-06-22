import { PrismaClient } from '@prisma/client';
process.env.DATABASE_URL = "postgresql://neondb_owner:npg_Te3IojQr6DXL@ep-silent-flower-abi2jpdp.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const prisma = new PrismaClient();

async function main() {
    const rules = await prisma.sourceFieldMapping.findMany({
        where: { targetFieldNo: 78 }
    });
    console.log("Mapping rules for Field 78:", rules);

    const clientLeId = "4e25cc42-d740-4b02-a561-27ef0d262504";
    const clientLe = await prisma.clientLE.findUnique({
        where: { id: clientLeId }
    });
    
    // Check if there are any RegistryDataPayload for this LE
    const dataRows = await prisma.registryDataPayload.findMany({
        where: {
            subjectLeId: clientLe!.legalEntityId!
        }
    });
    console.log(`Found ${dataRows.length} registry payload rows for this LE.`);
    for (const row of dataRows) {
        if (row.payloadJson && JSON.stringify(row.payloadJson).includes("61900")) {
            console.log(`Row ${row.id} from ${row.sourcePlatform} has 61900 in payload.`);
        }
    }
}
main().catch(console.error).finally(() => prisma.$disconnect());
