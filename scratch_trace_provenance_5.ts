import * as dotenv from "dotenv";
dotenv.config();
process.env.DATABASE_URL = process.env.DIRECT_URL;

import prisma from "./src/lib/prisma";
import { fetchProvenanceMap, resolveSourceCheckedAt } from "./src/lib/kyc/provenance-enricher";
import { KycStateService } from "./src/lib/kyc/KycStateService";
import { getFullMasterData } from "./src/actions/client-le";

async function main() {
    const refs = await prisma.registryReference.findMany({
        where: { lastSyncSucceededAt: { not: null } },
        include: { authority: true, clientLE: true }
    });
    
    const ref = refs.find((r: any) => r.lastSyncSucceededAt && r.lastSyncSucceededAt.toISOString().includes('2026-07-06'));
    if (!ref) {
        console.log("No ClientLE found with 6 Jul date.");
        return;
    }
    const clientLE = ref.clientLE as any;
    
    console.log("ClientLE registry reference:");
    console.log(ref.lastSyncSucceededAt.toISOString());

    // 5. fetchProvenanceMap
    console.log("\nfetchProvenanceMap():");
    try {
        const provMapLe = await fetchProvenanceMap({ clientLEId: clientLE.id });
        const val = provMapLe.registrationAuthorityMap.get('GB_COMPANIES_HOUSE') || provMapLe.registrationAuthorityMap.get('COMPANIES_HOUSE');
        console.log(val ? val.toISOString() : "Not found");
    } catch(e) { console.error(e); }
    
    // 6. resolveSourceCheckedAt
    console.log("\nresolveSourceCheckedAt():");
    const derived = await KycStateService.getAuthoritativeValue({ subjectLeId: clientLE.legalEntityId!, clientLEId: clientLE.id }, 3);
    const claim = await prisma.fieldClaim.findUnique({ where: { id: derived!.claimId } });
    if (claim) {
        const provMap = await fetchProvenanceMap({ clientLEId: clientLE.id });
        const resolvedCheck = resolveSourceCheckedAt(claim.sourceType, claim.sourceReference, claim.assertedAt, provMap);
        console.log(resolvedCheck?.toISOString());
    }
    
    // 7. DerivedValue.sourceCheckedAt
    console.log("\nDerivedValue.sourceCheckedAt:");
    console.log(derived?.sourceCheckedAt?.toISOString());
    
    // 8. FieldDisplayModel.source.lastValidatedAt
    console.log("\nFieldDisplayModel.source.lastValidatedAt:");
    // We can't easily run getFullMasterData without a valid session due to NextAuth, 
    // so we'll just pull it via KycLoader which is what getFullMasterData uses under the hood.
    // Wait, getFullMasterData uses KycStateService.resolveAllFields
    const resolvedAll = await KycStateService.resolveAllFields(
        { subjectLeId: clientLE.legalEntityId!, clientLEId: clientLE.id },
        [{ fieldNo: 3, isMultiValue: false }]
    );
    const f3 = resolvedAll.get(3);
    console.log(f3?.sourceCheckedAt?.toISOString());
}

main().catch(console.error);
