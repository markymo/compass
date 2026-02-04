
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const clientId = "d2988607-517c-4995-aa09-e733f712b059";

    console.log("--- DEBUG: Acme Hedge Fund Data ---");

    // 1. Check Org
    const org = await prisma.organization.findUnique({
        where: { id: clientId },
        include: {
            memberships: { include: { user: true } },
            ownedLEs: {
                where: { endAt: null },
                include: { clientLE: true }
            }
        }
    });

    if (!org) {
        console.log("Org NOT FOUND!");
        return;
    }

    console.log(`Org Name: ${org.name}`);
    console.log(`Total Direct Memberships: ${org.memberships.length}`);
    org.memberships.forEach(m => console.log(`- User: ${m.user.email} (Role: ${m.role})`));

    console.log(`\nTotal Owned Active LEs: ${org.ownedLEs.length}`);
    org.ownedLEs.forEach(o => console.log(`- LE: ${o.clientLE.name} (${o.clientLE.id})`));

    // 2. Check Logic from page.tsx (activeMembers query)
    console.log("\n--- Simulating Page Query ---");
    const pageMembers = await prisma.membership.findMany({
        where: {
            OR: [
                { organizationId: clientId },
                { clientLE: { owners: { some: { partyId: clientId, endAt: null } } } }
            ]
        },
        include: {
            user: true,
            clientLE: true
        }
    });

    console.log(`Page Query Found Members: ${pageMembers.length}`);
    pageMembers.forEach(m => {
        console.log(`- ${m.user.email} | Scope: ${m.organizationId ? 'ORG' : 'LE'} | LE: ${m.clientLE?.name}`);
    });

}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
