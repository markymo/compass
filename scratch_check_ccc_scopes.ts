import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const parties = await prisma.cCParty.findMany({
        where: { createdFromClaimId: { not: null } },
        select: { id: true, createdFromClaimId: true }
    });
    const addresses = await prisma.cCAddress.findMany({
        where: { createdFromClaimId: { not: null } },
        select: { id: true, createdFromClaimId: true }
    });

    const claimIds = [
        ...parties.map(p => p.createdFromClaimId as string),
        ...addresses.map(a => a.createdFromClaimId as string)
    ];

    if (claimIds.length === 0) {
        console.log("No claims promoted to CCC yet.");
        return;
    }

    const claims = await prisma.fieldClaim.findMany({
        where: { id: { in: claimIds } },
        select: { id: true, clientLeScopeId: true, fieldNo: true }
    });

    let scoped = 0;
    let unscoped = 0;
    for (const c of claims) {
        if (c.clientLeScopeId) scoped++;
        else unscoped++;
    }

    console.log(`Promoted Claims Total: ${claims.length}`);
    console.log(`Scoped: ${scoped}`);
    console.log(`Unscoped (null): ${unscoped}`);

    // Let's also check general PARTY/ADDRESS claims that COULD be promoted
    const partyDefs = await prisma.masterFieldDefinition.findMany({
        where: { appDataType: { in: ['PARTY', 'PERSON_OR_CONTACT', 'ADDRESS'] } },
        select: { fieldNo: true }
    });
    const fieldNos = partyDefs.map(d => d.fieldNo);

    const allPromotableClaims = await prisma.fieldClaim.findMany({
        where: { fieldNo: { in: fieldNos } },
        select: { clientLeScopeId: true }
    });

    let pScoped = 0;
    let pUnscoped = 0;
    for (const c of allPromotableClaims) {
        if (c.clientLeScopeId) pScoped++;
        else pUnscoped++;
    }

    console.log(`\nAll Promotable Claims (Party/Address) Total: ${allPromotableClaims.length}`);
    console.log(`Scoped: ${pScoped}`);
    console.log(`Unscoped (null): ${pUnscoped}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
