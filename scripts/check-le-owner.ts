
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const leName = 'EAST ANGLIA TWO LIMITED';
    const le = await prisma.clientLE.findFirst({
        where: { name: { contains: leName } },
        include: {
            owners: true,
            memberships: true
        }
    });

    if (!le) {
        console.log('LE not found');
        return;
    }

    console.log('LE ID:', le.id);
    console.log('Owners:', le.owners);

    if (le.owners.length > 0) {
        const ownerId = le.owners[0].partyId;
        console.log('Owner Party ID:', ownerId);

        const fields = await prisma.customFieldDefinition.findMany({
            where: { orgId: ownerId }
        });
        console.log('Custom Fields for Owner:', fields);
    } else {
        console.log('NO OWNERS FOUND!');
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
