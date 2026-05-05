import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("=== Backfill Verification ===");

    // 1. Inserted count by role
    const backfilled = await prisma.membership.groupBy({
        by: ['role'],
        where: { permissions: { path: ['source'], equals: 'backfill_2026_05' } },
        _count: { _all: true }
    });
    console.log("Total Backfilled Memberships:");
    console.log(backfilled.map(r => `  - ${r.role}: ${r._count._all}`).join('\n'));

    // 2. Sample one affected user
    const sampleBackfill = await prisma.membership.findFirst({
        where: { permissions: { path: ['source'], equals: 'backfill_2026_05' } }
    });

    if (sampleBackfill) {
        console.log(`\n=== Sample User Check: ${sampleBackfill.userId} ===`);
        const userMemberships = await prisma.membership.findMany({
            where: { userId: sampleBackfill.userId }
        });

        const orgMemberships = userMemberships.filter(m => m.organizationId !== null);
        const engMemberships = userMemberships.filter(m => m.fiEngagementId !== null);

        console.log(`Original ORG Memberships found: ${orgMemberships.length} (Roles: ${orgMemberships.map(m => m.role).join(', ')})`);
        console.log(`Engagement-scoped Memberships found: ${engMemberships.length} (Roles: ${engMemberships.map(m => m.role).join(', ')})`);
        
        // 4. Confirm permissions JSON marker exists
        const allHaveMarker = engMemberships.every(m => (m.permissions as any)?.source === 'backfill_2026_05');
        console.log(`All new engagement memberships have metadata marker: ${allHaveMarker}`);

        // 3. Confirm no duplicate scoped memberships
        const duplicates = engMemberships.filter((m, i, arr) => 
            arr.findIndex(x => x.fiEngagementId === m.fiEngagementId && x.role === m.role) !== i
        );
        console.log(`Duplicate scopes detected for this user: ${duplicates.length}`);
    } else {
        console.log("No backfilled users found to sample.");
    }

}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
