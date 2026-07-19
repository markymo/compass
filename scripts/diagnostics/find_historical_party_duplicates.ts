/**
 * scripts/diagnostics/find_historical_party_duplicates.ts
 *
 * Diagnostic script to find historical duplicate Party FieldClaims
 * caused by the missing idempotency check (CP5C).
 *
 * This script identifies active FieldClaims in repeating collections
 * where the canonical value is identical to another claim in the same
 * collection for the same entity and source.
 *
 * Run using:
 * npx tsx scripts/diagnostics/find_historical_party_duplicates.ts
 */

import { PrismaClient, SourceType } from '@prisma/client';
import { valuesAreCanonicallyEqual } from '../../src/lib/kyc/canonical-comparison';

const prisma = new PrismaClient();

async function run() {
    console.log('[Diagnostic] Fetching candidate FieldClaims...');
    
    // Find all FieldClaims that are part of repeating collections (e.g. FIELD_63, DIRECTORS)
    // where they have an embedded Party object (valueJson is an object)
    const claims = await prisma.fieldClaim.findMany({
        where: {
            status: { notIn: ['REJECTED', 'SUPERSEDED'] },
            sourceType: { notIn: [SourceType.USER_INPUT] },
            valueJson: { not: null },
            // Only looking at multi-value fields (which have collectionId set)
            collectionId: { not: null },
        },
        orderBy: { assertedAt: 'asc' },
    });

    console.log(`[Diagnostic] Retrieved ${claims.length} claims for analysis.`);

    // Group by [subjectLeId, collectionId, sourceType]
    const grouped = new Map<string, typeof claims>();

    for (const claim of claims) {
        // Skip scalar lists, focus on embedded JSON objects (like PARTY)
        if (typeof claim.valueJson !== 'object' || Array.isArray(claim.valueJson)) {
            continue;
        }

        const key = `${claim.subjectLeId}::${claim.collectionId}::${claim.sourceType}`;
        const group = grouped.get(key) || [];
        group.push(claim);
        grouped.set(key, group);
    }

    let duplicateCount = 0;
    let totalAnalyzed = 0;

    for (const [key, group] of grouped) {
        if (group.length < 2) continue;
        
        // We have multiple claims for the same entity + collection + source.
        // Compare each pair to find exact semantic duplicates.
        const uniques: typeof claims = [];
        const duplicates: typeof claims = [];

        for (const claim of group) {
            totalAnalyzed++;
            
            const isDuplicate = uniques.some(uniqueClaim => 
                valuesAreCanonicallyEqual(uniqueClaim.valueJson, claim.valueJson)
            );

            if (isDuplicate) {
                duplicates.push(claim);
                duplicateCount++;
            } else {
                uniques.push(claim);
            }
        }

        if (duplicates.length > 0) {
            const [subjectLeId, collectionId, sourceType] = key.split('::');
            console.log(`\nEntity: ${subjectLeId}`);
            console.log(`Collection: ${collectionId} | Source: ${sourceType}`);
            console.log(`Found ${duplicates.length} duplicate claims (total active: ${group.length}).`);
            for (const dup of duplicates) {
                console.log(`  - Duplicate Claim ID: ${dup.id} (instanceId: ${dup.instanceId})`);
            }
        }
    }

    console.log('\n=======================================');
    console.log(`[Diagnostic] Complete.`);
    console.log(`Total claims analyzed: ${totalAnalyzed}`);
    console.log(`Total duplicate claims identified: ${duplicateCount}`);
    console.log('=======================================');

    await prisma.$disconnect();
}

run().catch((e) => {
    console.error(e);
    process.exit(1);
});
