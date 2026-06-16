const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const claims = await prisma.fieldClaim.findMany({
        where: {
            valueJson: {
                not: require('@prisma/client').Prisma.AnyNull
            }
        },
        select: { id: true, fieldNo: true, valueJson: true, status: true, subjectLeId: true }
    });

    const partyRefs = claims.filter(c => c.valueJson && c.valueJson.ccPartyId);
    console.log("Found PARTY_REF claims:", JSON.stringify(partyRefs, null, 2));

    const refDefs = await prisma.masterFieldDefinition.findMany({
        where: { appDataType: 'PARTY_REF' },
        select: { fieldNo: true, fieldName: true }
    });
    console.log("PARTY_REF field defs:", JSON.stringify(refDefs, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
