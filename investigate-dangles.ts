import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const party = await prisma.cCParty.findFirst({
        where: {
            data: {
                path: ['surname'],
                equals: 'Dangles'
            }
        }
    });

    if (!party) {
        console.log("Do Dangles not found.");
        return;
    }

    console.log("1. CCParty id:", party.id);
    console.log("2. createdFromClaimId:", party.createdFromClaimId);

    const claims = await prisma.fieldClaim.findMany({
        where: {
            fieldNo: 63,
            sourceType: 'USER_INPUT',
        }
    });

    const matchingClaim = claims.find(c => {
        const val = c.valueJson as any;
        return val && val.ccPartyId === party.id;
    });

    if (matchingClaim) {
        console.log("3. FieldClaim exists: YES");
        console.log("4. FieldClaim details:");
        console.log(JSON.stringify({
            id: matchingClaim.id,
            fieldNo: matchingClaim.fieldNo,
            sourceType: matchingClaim.sourceType,
            valueJson: matchingClaim.valueJson,
            assertedAt: matchingClaim.assertedAt,
            status: matchingClaim.status,
            effectiveFrom: matchingClaim.effectiveFrom,
            effectiveTo: matchingClaim.effectiveTo,
        }, null, 2));
    } else {
        console.log("3. FieldClaim exists: NO");
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
