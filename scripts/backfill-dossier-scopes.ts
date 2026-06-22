import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const args = process.argv.slice(2);
    const isExecute = args.includes('--execute');
    const isConservative = args.includes('--conservative');
    const isProdConfirm = args.includes('--confirm-production');
    
    // Production guard
    const dbUrl = process.env.DATABASE_URL || '';
    const isProduction = dbUrl.includes('ep-silent-flower-abi2jpdp');

    if (isExecute && isProduction && !isProdConfirm) {
        console.error("\n❌ FATAL: Execution on production requires the --confirm-production flag.");
        console.error("Run with: --execute --confirm-production\n");
        process.exit(1);
    }

    console.log(`\n======================================================`);
    console.log(`   DOSSIER SCOPE BACKFILL SCRIPT`);
    console.log(`   Mode: ${isExecute ? '⚠️ EXECUTE (MUTATING)' : '🛡️ DRY RUN (READ-ONLY)'}`);
    if (isConservative) {
        console.log(`   Flag: 🔒 CONSERVATIVE (active ClientLEs only, skips orphans and ambiguous)`);
    }
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
        select: { id: true, legalEntityId: true, isDeleted: true, owners: { select: { partyId: true } } }
    });

    const leToCles = new Map<string, typeof allCles>();
    for (const cle of allCles) {
        if (!cle.legalEntityId) continue;
        if (isConservative && cle.isDeleted) continue;
        if (!leToCles.has(cle.legalEntityId)) leToCles.set(cle.legalEntityId, []);
        leToCles.get(cle.legalEntityId)!.push(cle);
    }

    const allNodes = await prisma.clientLEGraphNode.findMany({
        where: { personId: { not: null } },
        select: { clientLEId: true, personId: true, clientLE: { select: { isDeleted: true } } }
    });

    const personToCles = new Map<string, Set<string>>();
    for (const node of allNodes) {
        if (!node.personId) continue;
        if (isConservative && node.clientLE.isDeleted) continue;
        if (!personToCles.has(node.personId)) personToCles.set(node.personId, new Set());
        personToCles.get(node.personId)!.add(node.clientLEId);
    }

    let alreadyScoped = 0;
    let resolved = 0;
    let ambiguous = 0;
    let orphaned = 0;
    
    let skippedPerson = 0;
    let skippedOrphaned = 0;

    let ambiguousDetails: string[] = [];
    
    // Map of clientLeScopeId -> Array of FieldClaim IDs
    const updatesByDossier = new Map<string, string[]>();

    console.log("2. Mapping claims to ClientLE dossiers...");

    for (const claim of claims) {
        if (claim.clientLeScopeId) {
            alreadyScoped++;
            continue;
        }

        // Subject type skipping in conservative mode
        if (isConservative && claim.subjectPersonId && !claim.subjectLeId) {
            skippedPerson++;
            continue; // skips person claims
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
            if (isConservative) {
                skippedOrphaned++;
            } else {
                orphaned++;
            }
        }
    }

    console.log(`\n=== MAPPING RESULTS ===`);
    console.log(`Total Claims Fetched: ${claims.length}`);
    console.log(`Already Scoped: ${alreadyScoped}`);
    console.log(`✅ Resolved / Updateable (1:1 Match): ${resolved}`);
    
    if (isConservative) {
        console.log(`⚠️ Skipped Ambiguous (>1 Match): ${ambiguous}`);
        console.log(`⏭️ Skipped by Subject Type (Person): ${skippedPerson}`);
        console.log(`⏭️ Skipped Detached/Orphaned (0 Matches): ${skippedOrphaned}`);
    } else {
        console.log(`⚠️ Ambiguous (>1 Match): ${ambiguous}`);
        console.log(`❌ Orphaned (0 Matches): ${orphaned}`);
    }

    // In conservative mode, we skip ambiguous, so we don't abort.
    if (ambiguous > 0 && !isConservative) {
        console.log(`\nSample Ambiguous Claims (ABORTING DUE TO AMBIGUITY):`);
        ambiguousDetails.forEach(d => console.log(`  - ${d}`));
        if (isExecute) {
            console.log("\nFATAL: Cannot execute backfill while ambiguous claims exist. Please resolve them manually first or use --conservative mode.");
            process.exit(1);
        }
    }

    if (!isExecute) {
        console.log(`\n🛡️ Dry-run complete. ${resolved} claims are ready to be updated.`);
        console.log(`To apply these changes, run: npx tsx scripts/backfill-dossier-scopes.ts --execute${isConservative ? ' --conservative' : ''}${isProduction ? ' --confirm-production' : ''}`);
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
