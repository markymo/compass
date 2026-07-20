import { KycStateService } from './src/lib/kyc/KycStateService';
import prisma from './src/lib/prisma';

async function run() {
    const clientLeId = "3c3d0620-29bb-4ecf-babc-9a2a561d3a34";
    const fieldNo = 138;
    
    console.log(`Checking Client ${clientLeId}, Field ${fieldNo}`);
    
    // Check what KycStateService returns
    const derived = await KycStateService.getAuthoritativeValue(
        { subjectLeId: clientLeId, clientLEId: clientLeId },
        fieldNo,
        undefined, // ownerScopeId
        undefined
    );
    
    console.log("getAuthoritativeValue returned:", JSON.stringify(derived, null, 2));

    // Also look at the exact claims in DB for this client
    const claims = await prisma.fieldClaim.findMany({
        where: { fieldNo: 138, subjectLeId: clientLeId }
    });
    console.log("Claims with subjectLeId:", claims.length);

    const claims2 = await prisma.fieldClaim.findMany({
        where: { fieldNo: 138, clientLeScopeId: clientLeId }
    });
    console.log("Claims with clientLeScopeId:", claims2.length);
    console.log(JSON.stringify(claims2, null, 2));
}

run().finally(() => prisma.$disconnect());
