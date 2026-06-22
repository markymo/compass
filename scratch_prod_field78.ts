import { PrismaClient } from '@prisma/client';

process.env.DATABASE_URL = "postgresql://neondb_owner:npg_Te3IojQr6DXL@ep-silent-flower-abi2jpdp.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const prisma = new PrismaClient();

async function main() {
    console.log("DATABASE_URL host:", process.env.DATABASE_URL?.split('@')[1]?.split('/')[0]);

    const clientLeId = "4e25cc42-d740-4b02-a561-27ef0d262504";
    const clientLe = await prisma.clientLE.findUnique({
        where: { id: clientLeId }
    });

    if (!clientLe) {
        console.log("ClientLE not found in prod.");
        return;
    }

    console.log(`Subject LE ID: ${clientLe.legalEntityId}`);

    const claims = await prisma.fieldClaim.findMany({
        where: {
            fieldNo: 78,
            subjectLeId: clientLe.legalEntityId!
        }
    });

    console.log(`Found ${claims.length} claims for Field 78.`);
    for (const claim of claims) {
        console.log({
            id: claim.id,
            fieldNo: claim.fieldNo,
            valueText: claim.valueText,
            valueJson: claim.valueJson,
            sourceType: claim.sourceType,
            sourceReference: claim.sourceReference,
            ownerScopeId: claim.ownerScopeId,
            clientLeScopeId: claim.clientLeScopeId,
            collectionId: claim.collectionId,
            isTombstone: claim.isTombstone
        });
    }

    const mapRules = await prisma.sourceFieldMapping.findMany({
        where: {
            sourcePlatform: "COMPANIES_HOUSE"
        }
    });

    console.log(`Found ${mapRules.length} SourceFieldMapping rules for COMPANIES_HOUSE.`);
    const rule78 = mapRules.find(r => r.targetFieldNo === 78);
    console.log("Rule for 78:", rule78);

}

main().catch(console.error).finally(() => prisma.$disconnect());
