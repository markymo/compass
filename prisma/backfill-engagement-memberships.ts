import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const isDryRun = process.argv.includes('--dry-run');

    console.log(`Starting Engagement Membership Backfill${isDryRun ? ' (DRY RUN)' : ' (APPLY)'}`);

    // 1. Find target memberships
    const sourceMemberships = await prisma.membership.findMany({
        where: {
            organizationId: { not: null },
            clientLEId: null,
            fiEngagementId: null,
            role: { in: ['SUPPLIER_ADMIN', 'RELATIONSHIP_ADMIN', 'RELATIONSHIP_USER'] }
        }
    });

    // 2. Find target engagements
    const targetFiOrgIds = Array.from(new Set(sourceMemberships.map(m => m.organizationId as string)));
    const engagements = await prisma.fIEngagement.findMany({
        where: {
            fiOrgId: { in: targetFiOrgIds },
            isDeleted: false
        }
    });

    console.log(`Found ${sourceMemberships.length} eligible source memberships across ${targetFiOrgIds.length} FI Organizations.`);
    console.log(`Found ${engagements.length} active engagements in those organizations.`);

    // 3. Build insert payload
    let membershipsToInsert: any[] = [];
    const existingMembershipsCache = new Set(); // To avoid duplicates during generation

    for (const membership of sourceMemberships) {
        const orgEngagements = engagements.filter(e => e.fiOrgId === membership.organizationId);
        
        for (const engagement of orgEngagements) {
            const compositeKey = `${membership.userId}-${engagement.id}`;
            if (!existingMembershipsCache.has(compositeKey)) {
                membershipsToInsert.push({
                    userId: membership.userId,
                    fiEngagementId: engagement.id,
                    organizationId: null,
                    clientLEId: null,
                    role: membership.role
                });
                existingMembershipsCache.add(compositeKey);
            }
        }
    }

    console.log(`\n--- Dry Run Statistics ---`);
    console.log(`Unique Users Affected: ${new Set(membershipsToInsert.map(m => m.userId)).size}`);
    console.log(`Unique Engagements Affected: ${new Set(membershipsToInsert.map(m => m.fiEngagementId)).size}`);
    console.log(`Memberships to Insert: ${membershipsToInsert.length}`);
    console.log(`--------------------------\n`);

    if (isDryRun) {
        console.log("Dry run complete. Run without --dry-run to apply.");
        process.exit(0);
    }

    if (membershipsToInsert.length === 0) {
        console.log("No memberships to insert.");
        process.exit(0);
    }

    console.log("Applying backfill...");
    
    let insertedCount = 0;
    // We insert one by one or with createMany with skipDuplicates to avoid failing on existing partial index constraints
    try {
        const result = await prisma.membership.createMany({
            data: membershipsToInsert,
            skipDuplicates: true // Supported by postgres
        });
        insertedCount = result.count;
    } catch (e) {
        console.error("Failed batch insert. Falling back to individual inserts...", e);
        for (const m of membershipsToInsert) {
            try {
                await prisma.membership.create({ data: m });
                insertedCount++;
            } catch (err: any) {
                if (err.code !== 'P2002') { // Ignore unique constraint violation
                    console.error(`Failed to insert for user ${m.userId} eng ${m.fiEngagementId}:`, err.message);
                }
            }
        }
    }

    console.log(`Successfully inserted ${insertedCount} engagement-scoped memberships.`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
