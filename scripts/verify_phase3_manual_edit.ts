
import { KycWriteService } from "../src/services/kyc/KycWriteService";
import prisma from "../src/lib/prisma";

async function main() {
    console.log("Starting Phase 3 Verification: Manual Overrides & History");

    const writeService = new KycWriteService();
    const TEST_LEI = "PHASE3-TEST-LEI-" + Date.now();

    // 1. Setup: Create a ClientLE and LegalEntity via existing flow or manually
    // We'll manually create a ClientLE to trigger lazy creation
    // @ts-ignore
    const clientLE = await prisma.clientLE.create({
        data: {
            name: "Phase 3 Test Entity",
            lei: TEST_LEI
        }
    });
    console.log(`Created ClientLE: ${clientLE.id}`);

    // Trigger lazy creation by writing a field (Field 3: Legal Name) via ClientLE ID
    // Source: GLEIF
    console.log("1. Writing initial GLEIF value...");
    await writeService.updateField(
        clientLE.id,
        3, // Legal Name
        "Acme Corp (GLEIF)",
        { source: "GLEIF", confidence: 1.0 },
        undefined,
        "CLIENT_LE"
    );

    // Fetch LegalEntity ID
    // @ts-ignore
    const identity = await prisma.identityProfile.findUnique({
        where: { clientLEId: clientLE.id }
    });

    if (!identity || !identity.legalEntityId) {
        throw new Error("Legal Entity not created!");
    }
    const legalEntityId = identity.legalEntityId;
    console.log(`LegalEntity resolved: ${legalEntityId}`);

    // Verify current values
    // @ts-ignore
    const legEnt = await prisma.legalEntity.findUnique({
        where: { id: legalEntityId },
        include: { identityProfile: true }
    });
    // @ts-ignore
    console.log(`Current Legal Name: ${legEnt.identityProfile.legalName}`);
    // @ts-ignore
    if (legEnt.identityProfile.legalName !== "Acme Corp (GLEIF)") {
        throw new Error("Initial write failed");
    }

    // 2. Apply Manual Override (USER_INPUT)
    console.log("2. Applying Manual Override...");
    await writeService.applyManualOverride(
        legalEntityId,
        3,
        "Acme Corp LTD (User)",
        "Correcting legal name",
        "USER-123"
    );

    // Verify override
    // @ts-ignore
    const legEnt2 = await prisma.legalEntity.findUnique({
        where: { id: legalEntityId },
        include: { identityProfile: true }
    });
    // @ts-ignore
    console.log(`New Legal Name: ${legEnt2.identityProfile.legalName}`);
    // @ts-ignore
    if (legEnt2.identityProfile.legalName !== "Acme Corp LTD (User)") {
        throw new Error("Manual override failed to persist");
    }

    // 3. Verify MasterDataEvent
    console.log("3. Verifying Audit Log...");
    // @ts-ignore
    const events = await prisma.masterDataEvent.findMany({
        where: { legalEntityId, fieldNo: 3 },
        orderBy: { timestamp: 'asc' }
    });

    console.log(`Found ${events.length} events`);
    events.forEach((e: any) => {
        console.log(`- [${e.source}] ${e.oldValue} -> ${e.newValue} (Reason: ${e.reason})`);
    });

    if (events.length < 2) { // 1 GLEIF, 1 USER
        throw new Error("Audit log missing events");
    }
    const lastEvent = events[events.length - 1];
    if (lastEvent.source !== "USER_INPUT" || lastEvent.newValue !== "Acme Corp LTD (User)") {
        throw new Error("Last event distinct does not match Update");
    }

    // 4. Test Overwrite Protection (GLEIF update should fail)
    console.log("4. Testing Overwrite Protection (Ignoring GLEIF update)...");
    await writeService.updateField(
        clientLE.id, // Using ClientLE ID again (simulating GLEIF refresh)
        3,
        "Acme Corp (GLEIF V2)",
        { source: "GLEIF", confidence: 1.0 },
        undefined,
        "CLIENT_LE"
    );

    // @ts-ignore
    const legEnt3 = await prisma.legalEntity.findUnique({
        where: { id: legalEntityId },
        include: { identityProfile: true }
    });
    // @ts-ignore
    console.log(`Legal Name after GLEIF update attempt: ${legEnt3.identityProfile.legalName}`);
    // @ts-ignore
    if (legEnt3.identityProfile.legalName !== "Acme Corp LTD (User)") {
        throw new Error("User input was overwritten by GLEIF! Protection failed.");
    }

    // 5. Cleanup
    console.log("5. Cleaning up...");
    // @ts-ignore
    await prisma.clientLE.delete({ where: { id: clientLE.id } }); // Should cascade delete LE? No, cascade is other way.
    // We need to delete LE.
    // @ts-ignore
    await prisma.legalEntity.delete({ where: { id: legalEntityId } });
    // ClientLE relation to IdentityProfile... if I delete LE, IdentityProfile is deleted (cascade).
    // ClientLE remains.
    // @ts-ignore
    await prisma.clientLE.delete({ where: { id: clientLE.id } });

    console.log("Verification SUCCESS!");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
