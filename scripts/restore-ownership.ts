/**
 * Migration Script: Restore ClientLE Ownership
 * 
 * This script restores ownership for active ClientLEs by setting endAt to NULL
 * for their most recent ownership records.
 * 
 * Background: When organizations were archived, their ownership relationships
 * were terminated (endAt set to a timestamp). This left active ClientLEs orphaned.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function restoreOwnership() {
    console.log('=== ClientLE Ownership Restoration ===\n');

    try {
        // Step 1: Find all active ClientLEs without current owners
        const orphanedLEs = await prisma.clientLE.findMany({
            where: {
                isDeleted: false,
                status: { not: 'ARCHIVED' },
                owners: {
                    none: { endAt: null }
                }
            },
            include: {
                owners: {
                    orderBy: { startAt: 'desc' },
                    take: 1,
                    include: { party: true }
                }
            }
        });

        console.log(`Found ${orphanedLEs.length} orphaned ClientLEs\n`);

        if (orphanedLEs.length === 0) {
            console.log('✅ No orphaned ClientLEs found. All active LEs have current owners.');
            return;
        }

        // Step 2: Display what will be restored
        console.log('The following ownership relationships will be restored:\n');
        orphanedLEs.forEach(le => {
            const mostRecentOwner = le.owners[0];
            if (mostRecentOwner) {
                console.log(`  • ${le.name}`);
                console.log(`    → Owner: ${mostRecentOwner.party.name}`);
                console.log(`    → Period: ${mostRecentOwner.startAt} to ${mostRecentOwner.endAt}`);
                console.log('');
            }
        });

        // Step 3: Restore ownership (set endAt to NULL)
        console.log('Restoring ownership...\n');

        const ownerIdsToRestore = orphanedLEs
            .map(le => le.owners[0]?.id)
            .filter(Boolean) as string[];

        const result = await prisma.clientLEOwner.updateMany({
            where: {
                id: { in: ownerIdsToRestore }
            },
            data: {
                endAt: null
            }
        });

        console.log(`✅ Successfully restored ${result.count} ownership relationships\n`);

        // Step 4: Verify the fix
        console.log('Verifying restoration...\n');

        const stillOrphaned = await prisma.clientLE.findMany({
            where: {
                isDeleted: false,
                status: { not: 'ARCHIVED' },
                owners: {
                    none: { endAt: null }
                }
            }
        });

        if (stillOrphaned.length === 0) {
            console.log('✅ Verification successful! All active ClientLEs now have current owners.');
        } else {
            console.log(`⚠️  Warning: ${stillOrphaned.length} ClientLEs still orphaned:`);
            stillOrphaned.forEach(le => console.log(`  - ${le.name} (${le.id})`));
        }

        // Step 5: Display final summary
        console.log('\n=== Summary ===');
        const allLEs = await prisma.clientLE.findMany({
            where: { isDeleted: false, status: { not: 'ARCHIVED' } },
            include: {
                owners: {
                    where: { endAt: null },
                    include: { party: true }
                }
            }
        });

        console.log(`Total Active ClientLEs: ${allLEs.length}`);
        console.log(`With Current Owners: ${allLEs.filter(le => le.owners.length > 0).length}`);
        console.log(`Without Current Owners: ${allLEs.filter(le => le.owners.length === 0).length}`);

    } catch (error) {
        console.error('❌ Error during restoration:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Execute the migration
restoreOwnership()
    .then(() => {
        console.log('\n✅ Migration completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    });
