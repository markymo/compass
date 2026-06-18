import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
    const clientLE = await prisma.clientLE.findFirst({
        where: { legalEntityId: { not: null } },
        include: { legalEntity: true }
    });

    if (!clientLE) {
        console.log("No ClientLE found");
        return;
    }

    console.log("--- ClientLE ---");
    console.log(JSON.stringify({ id: clientLE.id, name: clientLE.name, legalEntityId: clientLE.legalEntityId }, null, 2));
    if (clientLE.legalEntity) {
        console.log("--- LegalEntity ---");
        console.log(JSON.stringify({ id: clientLE.legalEntity.id, reference: clientLE.legalEntity.reference }, null, 2));
    }

    const claims = await prisma.fieldClaim.findMany({
        where: { subjectLeId: clientLE.legalEntityId },
        take: 2,
        select: { id: true, fieldNo: true, subjectLeId: true, sourceType: true }
    });

    console.log("--- FieldClaims where subjectLeId = ClientLE.legalEntityId ---");
    console.log(JSON.stringify(claims, null, 2));

    const ccParties = await prisma.cCParty.findMany({
        where: { clientLEId: clientLE.id },
        take: 2,
        select: { id: true, clientLEId: true }
    });

    console.log("--- CCParties where clientLEId = ClientLE.id ---");
    console.log(JSON.stringify(ccParties, null, 2));

    const badClaims = await prisma.fieldClaim.findMany({
        where: { subjectLeId: clientLE.id },
        take: 2,
        select: { id: true, subjectLeId: true }
    });

    console.log("--- Bad Claims where subjectLeId = ClientLE.id ---");
    console.log(JSON.stringify(badClaims, null, 2));

    if (clientLE.legalEntityId) {
        const badParties = await prisma.cCParty.findMany({
            where: { clientLEId: clientLE.legalEntityId },
            take: 2,
            select: { id: true, clientLEId: true }
        });
        console.log("--- Bad Parties where clientLEId = ClientLE.legalEntityId ---");
        console.log(JSON.stringify(badParties, null, 2));
    }
}

run().catch(console.error).finally(() => prisma.$disconnect());
