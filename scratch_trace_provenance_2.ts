import prisma from "./src/lib/prisma";
import { fetchProvenanceMap, resolveSourceCheckedAt } from "./src/lib/kyc/provenance-enricher";
import { KycStateService } from "./src/lib/kyc/KycStateService";
import { getFullMasterData } from "./src/actions/client-le";

async function main() {
    // Let's find ANY ClientLE that has something on July 6th
    const refs = await prisma.clientLERegistryReference.findMany({
        where: {
            lastSyncSucceededAt: { not: null }
        },
        include: { authority: true, clientLE: true }
    });
    
    // Find one where date is 6th July
    const ref = refs.find(r => r.lastSyncSucceededAt && r.lastSyncSucceededAt.toISOString().includes('2026-07-06'));
    if (!ref) {
        console.log("No ClientLE found with 6 July date.");
        console.dir(refs.map(r => ({ id: r.clientLEId, date: r.lastSyncSucceededAt })), { depth: null });
        return;
    }
    
    const clientLE = ref.clientLE;
    
    console.log("==== FOUND ClientLE ====");
    console.log("ID:", clientLE.id);
    console.log("Name:", clientLE.name);
    console.log("SubjectLeId:", clientLE.legalEntityId);
    
    // 1. ClientLE.gleifFetchedAt
    console.log("\n--- 1. ClientLE.gleifFetchedAt ---");
    console.log(clientLE.gleifFetchedAt);
    
    // 2. ClientLE registry reference rows
    console.log("\n--- 2. ClientLE registry reference rows ---");
    const allRefs = await prisma.clientLERegistryReference.findMany({
        where: { clientLEId: clientLE.id },
        include: { authority: true }
    });
    console.dir(allRefs.map(r => ({
        authorityId: r.authorityId,
        authorityRegistryKey: r.authority?.registryKey,
        authorityName: r.authority?.name,
        lastSyncSucceededAt: r.lastSyncSucceededAt,
        lastSyncStatus: r.lastSyncStatus
    })), { depth: null });
    
    // 3. Latest successful EnrichmentRun rows for this ClientLE
    console.log("\n--- 3. EnrichmentRun rows ---");
    const runs = await prisma.enrichmentRun.findMany({
        where: { clientLEId: clientLE.id, status: "COMPLETED" },
        orderBy: { completedAt: 'desc' },
        include: { registrationAuthority: true }
    });
    console.dir(runs.map(r => ({
        completedAt: r.completedAt,
        status: r.status,
        registrationAuthorityId: r.registrationAuthorityId,
        registrationAuthorityName: r.registrationAuthority?.name,
        registrationAuthorityKey: r.registrationAuthority?.registryKey
    })), { depth: null });
    
    // 4. Winning Field 3 FieldClaim
    console.log("\n--- 4. Winning Field 3 FieldClaim ---");
    const derived = await KycStateService.getAuthoritativeValue({ subjectLeId: clientLE.legalEntityId! }, 3);
    if (!derived) {
        console.log("No DerivedValue for Field 3 found");
        return;
    }
    
    const claim = await prisma.fieldClaim.findUnique({ where: { id: derived.claimId } });
    if (claim) {
        console.dir({
            id: claim.id,
            sourceType: claim.sourceType,
            sourceReference: claim.sourceReference,
            assertedAt: claim.assertedAt,
            createdAt: claim.createdAt,
            updatedAt: claim.updatedAt
        }, { depth: null });
    } else {
        console.log("Claim not found for claimId", derived.claimId);
    }
    
    // 5. Output of fetchProvenanceMap(clientLeId)
    console.log("\n--- 5. Output of fetchProvenanceMap ---");
    try {
        const provMapLe = await fetchProvenanceMap(clientLE.id);
        console.log("fetchProvenanceMap(clientLE.id):");
        console.dir(provMapLe, { depth: null });
    } catch(e) {}
    try {
        const provMapSubj = await fetchProvenanceMap(clientLE.legalEntityId!);
        console.log("fetchProvenanceMap(subjectLeId):");
        console.dir(provMapSubj, { depth: null });
    } catch(e) {}
    
    // 6. Output of resolveSourceCheckedAt(...) for Field 3
    console.log("\n--- 6. Output of resolveSourceCheckedAt ---");
    if (claim) {
        const provMap = await fetchProvenanceMap(clientLE.legalEntityId!);
        const resolvedCheck = resolveSourceCheckedAt(claim.sourceType, claim.sourceReference, claim.assertedAt, provMap);
        console.log("Resolved Checked At:", resolvedCheck);
    }
    
    // 7. Returned DerivedValue.sourceCheckedAt
    console.log("\n--- 7. Returned DerivedValue.sourceCheckedAt ---");
    console.dir({ sourceCheckedAt: derived.sourceCheckedAt }, { depth: null });
    
    // 8. Final canonicalDisplayModel.source.lastValidatedAt
    console.log("\n--- 8. Final canonicalDisplayModel.source.lastValidatedAt ---");
    const fullData = await getFullMasterData(clientLE.id);
    if (fullData.success) {
        const field3Data = (fullData.data as any)[3];
        if (field3Data) {
            console.dir({
                value: field3Data.value,
                displayState: field3Data.displayState,
                source: field3Data.canonicalDisplayModel?.source
            }, { depth: null });
        }
    }
}

main().catch(console.error);
