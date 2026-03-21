const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function getClientOwner(clientLEId) {
    const owner = await prisma.clientLEOwner.findFirst({
        where: { clientLEId },
    });
    return owner ? owner.partyId : null;
}

async function backfillIdentityProfile(profile) {
    const subjectLeId = profile.legalEntityId;
    if (!subjectLeId) return;

    let ownerScopeId = null;
    if (profile.clientLEId) {
        ownerScopeId = await getClientOwner(profile.clientLEId);
    }

    const fieldMappings = [
        { field: 'leiValidationDate', fieldNo: 1 },
        { field: 'leiCode', fieldNo: 2 },
        { field: 'legalName', fieldNo: 3 },
        { field: 'regAddressLine1', fieldNo: 6 },
        { field: 'regAddressCity', fieldNo: 7 },
        { field: 'regAddressRegion', fieldNo: 8 },
        { field: 'regAddressCountry', fieldNo: 9 },
        { field: 'regAddressPostcode', fieldNo: 10 },
        { field: 'hqAddressLine1', fieldNo: 11 },
        { field: 'hqAddressCity', fieldNo: 12 },
        { field: 'hqAddressRegion', fieldNo: 13 },
        { field: 'hqAddressCountry', fieldNo: 14 },
        { field: 'hqAddressPostcode', fieldNo: 15 },
        { field: 'entityStatus', fieldNo: 26 },
        { field: 'entityCreationDate', fieldNo: 27 },
    ];

    for (const mapping of fieldMappings) {
        const val = profile[mapping.field];
        if (val === null || val === undefined) continue;

        await prisma.fieldClaim.create({
            data: {
                fieldNo: mapping.fieldNo,
                subjectLeId: subjectLeId,
                ownerScopeId: ownerScopeId,
                valueText: typeof val === 'string' ? val : null,
                valueDate: val instanceof Date ? val : null,
                valueNumber: typeof val === 'number' ? String(val) : null,
                sourceType: 'SYSTEM_DERIVED',
                status: 'VERIFIED', // Assume profile data is verified
                assertedAt: profile.updatedAt || new Date(),
            }
        });
    }
}

async function backfillStakeholder(s) {
    const subjectLeId = s.legalEntityId;
    if (!subjectLeId) return;

    // 1. Map Role to fieldNo
    let fieldNo = 62; // Default UBO
    if (s.role === 'DIRECTOR') fieldNo = 63;
    if (s.role === 'CONTROLLER') fieldNo = 64;

    // 2. Handle Person identity
    let valuePersonId = null;
    if (s.stakeholderType === 'INDIVIDUAL' || s.fullName) {
        const person = await prisma.person.create({
            data: {
                firstName: s.fullName ? s.fullName.split(' ')[0] : 'Unknown',
                lastName: s.fullName ? s.fullName.split(' ').slice(1).join(' ') : 'Unknown',
                dateOfBirth: s.dateOfBirth,
                placeOfBirth: s.placeOfBirth,
            }
        });
        valuePersonId = person.id;
    }

    // 3. Create Claim
    await prisma.fieldClaim.create({
        data: {
            fieldNo: fieldNo,
            subjectLeId: subjectLeId,
            ownerScopeId: null, // Legacy stakeholders were global
            valuePersonId: valuePersonId,
            valueText: s.stakeholderType === 'CORPORATE' ? s.legalName : null,
            collectionId: `STAKEHOLDERS_${fieldNo}`,
            instanceId: s.id, // Keep legacy ID as stable instance key
            sourceType: 'USER_INPUT',
            status: 'VERIFIED',
            assertedAt: s.updatedAt || new Date(),
        }
    });
}

async function main() {
    console.log("🚀 Starting Comprehensive Master Data Backfill...");

    const profiles = await prisma.identityProfile.findMany();
    console.log(`Processing ${profiles.length} IdentityProfiles...`);
    for (const p of profiles) await backfillIdentityProfile(p);

    const stakeholders = await prisma.stakeholder.findMany();
    console.log(`Processing ${stakeholders.length} Stakeholders...`);
    for (const s of stakeholders) await backfillStakeholder(s);

    console.log("✅ Backfill Complete!");
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
