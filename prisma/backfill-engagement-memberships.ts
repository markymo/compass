import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const isDryRun = process.argv.includes('--dry-run');

    console.log(`Starting Engagement Membership Backfill${isDryRun ? ' (DRY RUN)' : ' (APPLY)'}`);

    // 1. Find target memberships (FI users)
    const sourceMemberships = await prisma.membership.findMany({
        where: {
            organizationId: { not: null },
            organization: { types: { has: "FI" } },
            clientLEId: null,
            fiEngagementId: null,
            role: { in: ['ORG_ADMIN', 'ORG_MEMBER'] }
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

    // 2.b Find existing RELATIONSHIP_* memberships to guarantee idempotency manually
    const existingEngagementMemberships = await prisma.membership.findMany({
        where: {
            fiEngagementId: { not: null },
            role: { in: ['RELATIONSHIP_ADMIN', 'RELATIONSHIP_USER'] }
        },
        select: { userId: true, fiEngagementId: true, role: true }
    });
    
    // Create a fast lookup set for existing explicit memberships
    const existingDbSet = new Set(
        existingEngagementMemberships.map(m => `${m.userId}-${m.fiEngagementId}-${m.role}`)
    );

    console.log(`Found ${sourceMemberships.length} eligible source memberships across ${targetFiOrgIds.length} FI Organizations.`);
    console.log(`Found ${engagements.length} active engagements in those organizations.`);

    // 3. Build insert payload
    let membershipsToInsert: any[] = [];
    const inMemoryCache = new Set(); 

    for (const membership of sourceMemberships) {
        const orgEngagements = engagements.filter(e => e.fiOrgId === membership.organizationId);
        
        let targetRole = "RELATIONSHIP_USER";
        if (membership.role === "ORG_ADMIN") {
            targetRole = "RELATIONSHIP_ADMIN";
        }

        for (const engagement of orgEngagements) {
            const compositeKey = `${membership.userId}-${engagement.id}-${targetRole}`;
            
            // Skip if we already built it in this loop OR if it already exists in the database
            if (!inMemoryCache.has(compositeKey) && !existingDbSet.has(compositeKey)) {
                membershipsToInsert.push({
                    userId: membership.userId,
                    fiEngagementId: engagement.id,
                    organizationId: null, // Keep isolated
                    clientLEId: null, // Keep isolated
                    role: targetRole,
                    permissions: { source: "backfill_2026_05" } // Metadata marker
                });
                inMemoryCache.add(compositeKey);
            }
        }
    }

    console.log(`\n--- Dry Run Statistics ---`);
    console.log(`Unique Users Affected: ${new Set(membershipsToInsert.map(m => m.userId)).size}`);
    console.log(`Unique Engagements Affected: ${new Set(membershipsToInsert.map(m => m.fiEngagementId)).size}`);
    console.log(`Memberships to Insert: ${membershipsToInsert.length}`);
    const adminCount = membershipsToInsert.filter(m => m.role === 'RELATIONSHIP_ADMIN').length;
    const userCount = membershipsToInsert.filter(m => m.role === 'RELATIONSHIP_USER').length;
    console.log(`  - as RELATIONSHIP_ADMIN: ${adminCount}`);
    console.log(`  - as RELATIONSHIP_USER: ${userCount}`);
    console.log(`--------------------------\n`);

    if (isDryRun) {
        console.log("Dry run complete. Run without --dry-run to apply.");
        process.exit(0);
    }

    if (membershipsToInsert.length === 0) {
        console.log("No memberships to insert. System is already up to date.");
        process.exit(0);
    }

    console.log("Applying backfill...");
    
    let insertedCount = 0;
    let insertedAdmin = 0;
    let insertedUser = 0;

    for (const m of membershipsToInsert) {
        try {
            await prisma.membership.create({ data: m });
            insertedCount++;
            if (m.role === 'RELATIONSHIP_ADMIN') insertedAdmin++;
            if (m.role === 'RELATIONSHIP_USER') insertedUser++;
        } catch (err: any) {
            if (err.code !== 'P2002') { // Ignore unique constraint violation just in case
                console.error(`Failed to insert for user ${m.userId} eng ${m.fiEngagementId}:`, err.message);
            }
        }
    }

    console.log(`\n=== FINAL CONFIRMATION ===`);
    console.log(`Total successfully inserted: ${insertedCount}`);
    console.log(`- RELATIONSHIP_ADMIN inserted: ${insertedAdmin}`);
    console.log(`- RELATIONSHIP_USER inserted:  ${insertedUser}`);
    console.log(`==========================\n`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
