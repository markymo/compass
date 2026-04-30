import { PrismaClient, SourceType, ClaimStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const clientLeId = '3f3b592b-20e3-46c8-9eb1-9af01958f99f';

    const clientLe = await prisma.clientLE.findUnique({
        where: { id: clientLeId }
    });

    if (!clientLe) {
        console.error(`ClientLE ${clientLeId} not found.`);
        return;
    }

    const legalEntityId = clientLe.legalEntityId;

    if (!legalEntityId) {
        console.error(`ClientLE ${clientLeId} does not have an attached LegalEntity.`);
        return;
    }

    console.log(`Targeting LegalEntity: ${legalEntityId}`);

    // 1. Create a Structured Address Record
    const regAddress = await prisma.address.create({
        data: {
            line1: '123 Innovation Drive',
            line2: 'Suite 400',
            city: 'London',
            region: 'Greater London',
            postalCode: 'EC1V 2NX',
            country: 'GB'
        }
    });

    // 2. Assert FieldClaim for Registered Address (Field 120) -> Point to Address Object
    await prisma.fieldClaim.create({
        data: {
            fieldNo: 120,
            subjectLeId: legalEntityId,
            valueAddressId: regAddress.id, // Pointer Reference!
            sourceType: SourceType.SYSTEM_DERIVED,
            status: ClaimStatus.VERIFIED,
            sourceReference: 'Seed Script - Graph Demo'
        }
    });
    console.log(`✅ Seeded Structured Registered Address Claim (Address ID: ${regAddress.id})`);

    // 3. Create a Person Record
    const uboPerson = await prisma.person.create({
        data: {
            firstName: 'Elias',
            lastName: 'Sterling',
            middleName: 'J',
            dateOfBirth: new Date('1982-05-14'),
            placeOfBirth: 'Zurich, CH',
            primaryNationality: 'CH',
            isPublicFigure: false
        }
    });

    // 4. Assert FieldClaim for UBO (Field 62) -> Point to Person Object
    await prisma.fieldClaim.create({
        data: {
            fieldNo: 62,
            subjectLeId: legalEntityId,
            valuePersonId: uboPerson.id, // Pointer Reference!
            sourceType: SourceType.SYSTEM_DERIVED,
            status: ClaimStatus.VERIFIED,
            sourceReference: 'Seed Script - Graph Demo',
            collectionId: 'STAKEHOLDER', // Logical table
            instanceId: uboPerson.id // Representing one row in the list
        }
    });
    console.log(`✅ Seeded Structured UBO Claim (Person ID: ${uboPerson.id})`);

    // 5. Let's create an address FOR that person just to show relational depth!
    const uboAddress = await prisma.address.create({
        data: {
            line1: 'Bahnhofstrasse 45',
            city: 'Zurich',
            country: 'CH',
            postalCode: '8001'
        }
    });

    // Person Address Claim (say Field 200, but we don't have it explicitly bound yet, 
    // so we just link it structurally). Alternatively, we demonstrate depth later. 
    console.log(`✅ Seeded Person Residential Address (Address ID: ${uboAddress.id})`);

}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
