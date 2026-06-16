import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import { getMasterFieldDefinition } from './src/services/masterData/definitionService';

async function main() {
    const fieldNo = 63;
    const subjectLeId = '3ffde2ef-985c-4531-b991-c8feae2a2da9';
    const def = await getMasterFieldDefinition(fieldNo);
    console.log("AppDataType:", def.appDataType);
    if (def && (def.appDataType === 'PARTY' || def.appDataType === 'PERSON_OR_CONTACT')) {
        const promotedParties = await prisma.cCParty.findMany({
            where: { clientLEId: subjectLeId, createdFromClaimId: { not: null } },
            select: { createdFromClaimId: true }
        });
        console.log("promotedParties fetched:", promotedParties);
        const promotedClaimIds = new Set(promotedParties.map((p: any) => p.createdFromClaimId as string));
        console.log("promotedClaimIds set:", Array.from(promotedClaimIds));
    } else {
        console.log("Did not match appDataType!");
    }
}
main();
