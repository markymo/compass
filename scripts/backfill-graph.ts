import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfill() {
    console.log("Starting backfill locally...");
    const clientLEId = '3f3b592b-20e3-46c8-9eb1-9af01958f99f';
    const clientLE = await prisma.clientLE.findUnique({ where: { id: clientLEId }});
    const legalEntityId = clientLE?.legalEntityId;

    if (!legalEntityId) {
        console.log("No underlying LegalEntity");
        return;
    }

    const claims = await prisma.fieldClaim.findMany({
        where: { subjectLeId: legalEntityId }
    });

    console.log(`Found ${claims.length} claims for legal_entity: ${legalEntityId}`);

    let createdNodes = 0;

    for (const claim of claims) {
        if (claim.valuePersonId) {
            const exists = await prisma.clientLEGraphNode.findFirst({
                where: { clientLEId, personId: claim.valuePersonId }
            });
            if (!exists) {
                await prisma.clientLEGraphNode.create({
                    data: {
                        clientLEId,
                        nodeType: 'PERSON',
                        personId: claim.valuePersonId,
                        source: claim.sourceType || 'UNKNOWN'
                    }
                });
                createdNodes++;
            }
        }

        if (claim.valueLeId) {
            const exists = await prisma.clientLEGraphNode.findFirst({
                where: { clientLEId, legalEntityId: claim.valueLeId }
            });
            if (!exists) {
                await prisma.clientLEGraphNode.create({
                    data: {
                        clientLEId,
                        nodeType: 'LEGAL_ENTITY',
                        legalEntityId: claim.valueLeId,
                        source: claim.sourceType || 'UNKNOWN'
                    }
                });
                createdNodes++;
            }
        }

        if (claim.valueAddressId) {
            const exists = await prisma.clientLEGraphNode.findFirst({
                where: { clientLEId, addressId: claim.valueAddressId }
            });
            if (!exists) {
                await prisma.clientLEGraphNode.create({
                    data: {
                        clientLEId,
                        nodeType: 'ADDRESS',
                        addressId: claim.valueAddressId,
                        source: claim.sourceType || 'UNKNOWN'
                    }
                });
                createdNodes++;
            }
        }
    }

    console.log(`Backfill complete! Forged ${createdNodes} Ecosystem Edges in the Knowledge Graph for ${clientLEId}`);
}

backfill().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
