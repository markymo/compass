import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const args = process.argv.slice(2);
    const isExecute = args.includes('--execute');
    
    console.log(`\n======================================================`);
    console.log(`   DOSSIER SCOPE BACKFILL SCRIPT`);
    console.log(`   Mode: ${isExecute ? '⚠️ EXECUTE (MUTATING)' : '🛡️ DRY RUN (READ-ONLY)'}`);
    console.log(`======================================================\n`);

    if (isExecute) {
        console.log("WARNING: You are running in EXECUTE mode. The database will be mutated.");
        console.log("Ensure you have taken a database backup or branch before proceeding on production.\n");
    }

    console.log("1. Fetching claims and building graph matrices...");

    const claims = await prisma.fieldClaim.findMany({
        select: { 
            id: true, 
            subjectLeId: true, 
            subjectPersonId: true, 
            ownerScopeId: true,
            clientLeScopeId: true,
            sourceType: true
        }
    });

    const allCles = await prisma.clientLE.findMany({
        select: { id: true, legalEntityId: true, owners: { select: { partyId: true } } }
    });

    const leToCles = new Map<string, typeof allCles>();
    for (const cle of allCles) {
        if (!cle.legalEntityId) continue;
        if (!leToCles.has(cle.legalEntityId)) leToCles.set(cle.legalEntityId, []);
        leToCles.get(cle.legalEntityId)!.push(cle);
    }

    const allNodes = await prisma.clientLEGraphNode.findMany({
        where: { personId: { not: null } },
        select: { clientLEId: true, personId: true }
    });

    const personToCles = new Map<string, Set<string>>();
    for (const node of allNodes) {
        if (!node.personId) continue;
        if (!personToCles.has(node.personId)) personToCles.set(node.personId, new Set());
        personToCles.get(node.personId)!.add(node.clientLEId);
    }

    let resolved = 0;
    let ambiguous = 0;
    let orphaned = 0;

    let ambiguousDetails: string[] = [];
    
    // Map of clientLeScopeId -> Array of FieldClaim IDs
    const updatesByDossier = new Map<string, string[]>();

    console.log("2. Mapping claims to ClientLE dossiers...");

    for (const claim of claims) {
        if (claim.clientLeScopeId) {
            // Idempotency: skip claims that are already backfilled
            continue;
        }

        let matchingClientLeIds: string[] = [];

        if (claim.subjectLeId) {
            const cles = leToCles.get(claim.subjectLeId) || [];
            if (claim.ownerScopeId && claim.sourceType === 'USER_INPUT') {
                for (const cle of cles) {
                    const hasOwner = cle.owners.some(o => o.partyId === claim.ownerScopeId);
                    if (hasOwner) matchingClientLeIds.push(cle.id);
                }
            } else {
                matchingClientLeIds = cles.map(c => c.id);
            }
        } 
        else if (claim.subjectPersonId) {
            const set = personToCles.get(claim.subjectPersonId);
            if (set) matchingClientLeIds = Array.from(set);
        }

        if (matchingClientLeIds.length === 1) {
            resolved++;
            const targetCleId = matchingClientLeIds[0];
            if (!updatesByDossier.has(targetCleId)) updatesByDossier.set(targetCleId, []);
            updatesByDossier.get(targetCleId)!.push(claim.id);
        } else if (matchingClientLeIds.length > 1) {
            ambiguous++;
            if (ambiguousDetails.length < 5) {
                ambiguousDetails.push(`Claim ${claim.id} (LE: ${claim.subjectLeId}, Person: ${claim.subjectPersonId}) matched ${matchingClientLeIds.length} dossiers.`);
            }
        } else {
            orphaned++;
        }
    }

    console.log(`\n=== MAPPING RESULTS ===`);
    console.log(`Total Claims Analyzed: ${claims.length}`);
    console.log(`✅ Resolved (1:1 Match): ${resolved}`);
    console.log(`⚠️ Ambiguous (>1 Match): ${ambiguous}`);
    console.log(`❌ Orphaned (0 Matches): ${orphaned} (e.g. no valid subject)`);

    if (ambiguous > 0) {
        console.log(`\nSample Ambiguous Claims (ABORTING DUE TO AMBIGUITY):`);
        ambiguousDetails.forEach(d => console.log(`  - ${d}`));
        if (isExecute) {
            console.log("\nFATAL: Cannot execute backfill while ambiguous claims exist. Please resolve them manually first.");
            process.exit(1);
        }
    }

    if (!isExecute) {
        console.log(`\n🛡️ Dry-run complete. ${resolved} claims are ready to be updated.`);
        console.log(`To apply these changes, run: npx tsx scripts/backfill-dossier-scopes.ts --execute`);
        return;
    }

    console.log(`\n3. Executing batch updates...`);
    
    try {
        let updatedCount = 0;
        let batchNo = 1;
        const totalBatches = updatesByDossier.size;

        for (const [targetCleId, claimIds] of updatesByDossier.entries()) {
            await prisma.fieldClaim.updateMany({
                where: { id: { in: claimIds } },
                data: { clientLeScopeId: targetCleId }
            });
            updatedCount += claimIds.length;
            
            if (batchNo % 10 === 0 || batchNo === totalBatches) {
                console.log(`  -> Progress: Updated ${updatedCount} claims across ${batchNo}/${totalBatches} dossiers.`);
            }
            batchNo++;
        }

        console.log(`\n✅ EXECUTION COMPLETE: Successfully backfilled ${updatedCount} claims with their dossier scope.`);
    } catch (e) {
        console.error("\n❌ FATAL ERROR DURING EXECUTION:", e);
        process.exit(1);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
