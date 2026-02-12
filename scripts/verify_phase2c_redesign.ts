
import { EvidenceService } from "@/services/kyc/EvidenceService";
import { mapGleifPayloadToFieldCandidates } from "@/services/kyc/normalization/GleifNormalizer";
import { KycWriteService } from "@/services/kyc/KycWriteService";
import prisma from "@/lib/prisma";

async function main() {
    console.log("🚀 Starting Phase 2C Verification...");

    const evidenceService = new EvidenceService();
    const kycService = new KycWriteService();

    // 0. Setup: Create a test Legal Entity
    const ref = `TEST-LE-${Date.now()}`;
    const testEntity = await prisma.legalEntity.create({
        data: { reference: ref }
    });
    console.log(`Created Test Entity: ${testEntity.id}`);

    // 1. Simulate GLEIF Payload Ingestion
    const gleifPayload = {
        attributes: {
            lei: "5493006MHB84DD0ZWV18",
            entity: {
                legalName: { name: "Test Corp Global Ltd" },
                legalAddress: {
                    addressLines: ["123 Global Way"],
                    city: "London",
                    country: "GB"
                },
                creationDate: "2020-01-01T00:00:00Z",
                status: "ACTIVE"
            }
        }
    };

    console.log("1. Normalizing Evidence...");
    const evidenceId = await evidenceService.normalizeEvidence(
        gleifPayload,
        "GLEIF",
        "2.0",
        "SYSTEM"
    );
    console.log(`   Evidence ID: ${evidenceId}`);

    // 2. Map to Candidates
    console.log("2. Mapping to Candidates...");
    const candidates = mapGleifPayloadToFieldCandidates(gleifPayload, evidenceId);
    console.log(`   Mapped ${candidates.length} candidates.`);

    // 3. Apply Candidates (GLEIF Source)
    console.log("3. Applying Candidates (GLEIF)...");
    for (const candidate of candidates) {
        const success = await kycService.applyFieldCandidate(testEntity.id, candidate);
        if (!success) console.error(`   Failed to apply Field ${candidate.fieldNo}`);
    }

    // Verify DB State
    const profile = await prisma.identityProfile.findUnique({
        where: { legalEntityId: testEntity.id }
    });
    console.log("   DB State (IdentityProfile):", profile?.legalName, profile?.leiCode);
    const meta = profile?.meta as any;
    console.log("   Provenance (Legal Name):", meta?.legalName);

    if (profile?.legalName !== "Test Corp Global Ltd") throw new Error("Verification Failed: Legal Name mismatch");
    if (meta?.legalName?.source !== "GLEIF") throw new Error("Verification Failed: Source mismatch");

    // 4. Test Overwrite Rules
    console.log("4. Testing Overwrite Rules...");

    // 4a. Try to overwrite GLEIF with COMPANIES_HOUSE (Should Fail)
    console.log("   a) COMPANIES_HOUSE vs GLEIF (Target: Fail)...");
    const chCandidate = {
        fieldNo: 3, // Legal Name
        value: "Test Corp Local Variant",
        source: "COMPANIES_HOUSE" as const,
        evidenceId: "mock-ch-evidence",
        confidence: 0.8
    };
    const chSuccess = await kycService.applyFieldCandidate(testEntity.id, chCandidate);
    if (chSuccess) {
        console.error("   ❌ ERROR: COMPANIES_HOUSE overwrote GLEIF (Should be denied)");
    } else {
        console.log("   ✅ SUCCESS: COMPANIES_HOUSE write denied");
    }

    // 4b. Try to overwrite GLEIF with USER_INPUT (Should Succeed)
    console.log("   b) USER_INPUT vs GLEIF (Target: Success)...");
    const userCandidate = {
        fieldNo: 3,
        value: "Test Corp User Override",
        source: "USER_INPUT" as const,
        evidenceId: "mock-user-edit",
        confidence: 1.0
    };
    const userSuccess = await kycService.applyFieldCandidate(testEntity.id, userCandidate, "user-id-123");

    const profileAfterUser = await prisma.identityProfile.findUnique({
        where: { legalEntityId: testEntity.id }
    });

    if (userSuccess && profileAfterUser?.legalName === "Test Corp User Override") {
        console.log("   ✅ SUCCESS: User Input overwrote GLEIF");
    } else {
        console.error("   ❌ ERROR: User Input failed to overwrite");
    }

    // 4c. Try to overwrite USER_INPUT with GLEIF (Should Fail)
    console.log("   c) GLEIF vs USER_INPUT (Target: Fail)...");
    const gleifUpdateCandidate = {
        fieldNo: 3,
        value: "Test Corp Global Ltd Re-Ingest",
        source: "GLEIF" as const,
        evidenceId: "new-evidence-id",
        confidence: 1.0
    };
    const gleifUpdateSuccess = await kycService.applyFieldCandidate(testEntity.id, gleifUpdateCandidate);
    if (gleifUpdateSuccess) {
        console.error("   ❌ ERROR: GLEIF overwrote USER_INPUT (Should be denied)");
    } else {
        console.log("   ✅ SUCCESS: GLEIF write denied against User Input");
    }

    console.log("🎉 Verification Complete.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
