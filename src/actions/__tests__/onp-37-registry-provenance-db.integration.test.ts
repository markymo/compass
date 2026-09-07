import path from "path";
import fs from "fs";
import dotenv from "dotenv";

// a. Load .env.uat.local with override: true
const envUatLocal = path.resolve(process.cwd(), ".env.uat.local");
if (fs.existsSync(envUatLocal)) {
    dotenv.config({ path: envUatLocal, override: true });
}

// b. Set ONPRO_DB_TEST_ENV=uat
process.env.ONPRO_DB_TEST_ENV = "uat";

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { assertUatDbTestEnv } from "@/lib/kyc/__tests__/test-env-guard";

// c. Call assertUatDbTestEnv() immediately
assertUatDbTestEnv();

vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });

// d. Dynamically imported references
let prisma: typeof import("@/lib/prisma").default;
let KycStateService: typeof import("@/lib/kyc/KycStateService").KycStateService;
let resolveCanonicalFieldDisplay: typeof import("@/lib/export/export-answer-resolver").resolveCanonicalFieldDisplay;

describe("ONP-37 — Real Companies House & GLEIF Provenance Resolution (UAT Guarded)", () => {
    const PREFIX = "SYNTH_ONP37_";
    let testClientLeCh: any;
    let testClientLeGleif: any;
    let testOrg: any;
    let createdClaimIds: string[] = [];
    let createdRefIds: string[] = [];

    const cleanTestData = async () => {
        if (!prisma) return;

        // 1. Delete claims
        if (createdClaimIds.length > 0) {
            await prisma.fieldClaim.deleteMany({
                where: { id: { in: createdClaimIds } },
            });
        }
        await prisma.fieldClaim.deleteMany({
            where: {
                OR: [
                    { valueText: { startsWith: PREFIX } },
                    { clientLE: { name: { startsWith: PREFIX } } },
                ],
            },
        });

        // 2. Delete registry references
        if (createdRefIds.length > 0) {
            await prisma.registryReference.deleteMany({
                where: { id: { in: createdRefIds } },
            });
        }
        await prisma.registryReference.deleteMany({
            where: { clientLE: { name: { startsWith: PREFIX } } },
        });

        // 3. Delete ClientLE owners
        await prisma.clientLEOwner.deleteMany({
            where: {
                OR: [
                    { clientLE: { name: { startsWith: PREFIX } } },
                    { party: { name: { startsWith: PREFIX } } },
                ],
            },
        });

        // 4. Delete ClientLEs
        await prisma.clientLE.deleteMany({
            where: { name: { startsWith: PREFIX } },
        });

        // 5. Delete Orgs
        await prisma.organization.deleteMany({
            where: { name: { startsWith: PREFIX } },
        });
    };

    beforeAll(async () => {
        // Enforce UAT safety guard
        assertUatDbTestEnv();

        // Dynamically import modules only after safety assertion
        const prismaModule = await import("@/lib/prisma");
        prisma = prismaModule.default;
        const kycModule = await import("@/lib/kyc/KycStateService");
        KycStateService = kycModule.KycStateService;
        const exportModule = await import("@/lib/export/export-answer-resolver");
        resolveCanonicalFieldDisplay = exportModule.resolveCanonicalFieldDisplay;

        await cleanTestData();

        const rand = Math.floor(Math.random() * 1000000);

        // 1. Create Organization
        testOrg = await prisma.organization.create({
            data: { name: `${PREFIX}Org_${rand}`, types: ["SUPPLIER"] },
        });

        // 2. Create Companies House ClientLE with RegistryReference (RA000585, company number 07640868)
        testClientLeCh = await prisma.clientLE.create({
            data: {
                name: `${PREFIX}CH_LE_${rand}`,
                owners: { create: [{ partyId: testOrg.id }] },
            },
        });

        const chRef = await prisma.registryReference.create({
            data: {
                clientLEId: testClientLeCh.id,
                registryAuthorityId: "RA000585",
                localRegistrationNumber: "07640868",
                lastSyncSucceededAt: new Date("2026-08-30T12:00:00.000Z"),
            },
        });
        createdRefIds.push(chRef.id);

        // 3. Create Companies House Claim for Field 3 (Legal Name), with evidenceId: null (real production state)
        const chClaim = await prisma.fieldClaim.create({
            data: {
                fieldNo: 3, // Field 3 = Legal Name (non-company-number field)
                claimRole: "VALUE",
                status: "ASSERTED",
                sourceType: "REGISTRATION_AUTHORITY",
                sourceReference: "RA000585",
                valueText: `${PREFIX}Acme Industrial UK Ltd`,
                evidenceId: null, // Proving genuine production state where evidenceId is null
                clientLEId: testClientLeCh.id,
                assertedAt: new Date("2026-08-30T12:00:00.000Z"),
            },
        });
        createdClaimIds.push(chClaim.id);

        // 4. Create GLEIF ClientLE with LEI (213800AB12CD34EF5678)
        testClientLeGleif = await prisma.clientLE.create({
            data: {
                name: `${PREFIX}GLEIF_LE_${rand}`,
                lei: "213800AB12CD34EF5678",
                gleifFetchedAt: new Date("2026-08-30T12:00:00.000Z"),
                owners: { create: [{ partyId: testOrg.id }] },
            },
        });

        // 5. Create GLEIF Claim for Field 3 (Legal Name), with evidenceId: null
        const gleifClaim = await prisma.fieldClaim.create({
            data: {
                fieldNo: 3,
                claimRole: "VALUE",
                status: "ASSERTED",
                sourceType: "GLEIF",
                sourceReference: "GLEIF",
                valueText: `${PREFIX}Acme Global Holdings Ltd`,
                evidenceId: null,
                clientLEId: testClientLeGleif.id,
                assertedAt: new Date("2026-08-30T12:00:00.000Z"),
            },
        });
        createdClaimIds.push(gleifClaim.id);
    });

    afterAll(async () => {
        await cleanTestData();

        // Verify zero synthetic residue in DB
        const remainingClaims = await prisma.fieldClaim.count({
            where: {
                OR: [
                    { valueText: { startsWith: PREFIX } },
                    { clientLE: { name: { startsWith: PREFIX } } },
                ],
            },
        });
        const remainingRefs = await prisma.registryReference.count({
            where: { clientLE: { name: { startsWith: PREFIX } } },
        });
        const remainingOwners = await prisma.clientLEOwner.count({
            where: {
                OR: [
                    { clientLE: { name: { startsWith: PREFIX } } },
                    { party: { name: { startsWith: PREFIX } } },
                ],
            },
        });
        const remainingLEs = await prisma.clientLE.count({
            where: { name: { startsWith: PREFIX } },
        });
        const remainingOrgs = await prisma.organization.count({
            where: { name: { startsWith: PREFIX } },
        });

        expect(remainingClaims).toBe(0);
        expect(remainingRefs).toBe(0);
        expect(remainingOwners).toBe(0);
        expect(remainingLEs).toBe(0);
        expect(remainingOrgs).toBe(0);
    });

    it("Companies House non-ID field (Field 3 Legal Name with evidenceId: null) resolves entityUrl 07640868 via DB source context", async () => {
        // Resolve authoritative value through real KycStateService DB path
        const derived = await KycStateService.getAuthoritativeValue(
            { clientLEId: testClientLeCh.id },
            3
        );

        expect(derived).not.toBeNull();
        expect(derived?.value).toContain("Acme Industrial UK Ltd");
        expect(derived?.sourceType).toBe("REGISTRATION_AUTHORITY");
        expect(derived?.sourceReference).toBe("RA000585");
        expect(derived?.entityIdentifier).toBe("07640868");
        expect(derived?.entityUrl).toBe(
            "https://find-and-update.company-information.service.gov.uk/company/07640868"
        );

        // Resolve display model through export answer resolver
        const { displayModel } = await resolveCanonicalFieldDisplay({
            derivedValue: derived!.value,
            primarySource: {
                type: derived!.sourceType as any,
                reference: derived!.sourceReference,
                timestamp: derived!.assertedAt,
                entityIdentifier: derived!.entityIdentifier,
                entityUrl: derived!.entityUrl,
                userName: null,
            },
            meta: { fieldNo: 3, label: "Legal Name", displayState: "HAS_VALUE" },
        });

        expect(displayModel.source?.type).toBe("REGISTRATION_AUTHORITY");
        expect(displayModel.source?.reference).toBe("RA000585");
        expect(displayModel.source?.entityIdentifier).toBe("07640868");
        expect(displayModel.source?.entityUrl).toBe(
            "https://find-and-update.company-information.service.gov.uk/company/07640868"
        );
    });

    it("GLEIF non-ID field (Field 3 Legal Name with evidenceId: null) resolves entityUrl LEI via DB source context", async () => {
        const derived = await KycStateService.getAuthoritativeValue(
            { clientLEId: testClientLeGleif.id },
            3
        );

        expect(derived).not.toBeNull();
        expect(derived?.value).toContain("Acme Global Holdings Ltd");
        expect(derived?.sourceType).toBe("GLEIF");
        expect(derived?.entityIdentifier).toBe("213800AB12CD34EF5678");
        expect(derived?.entityUrl).toBe(
            "https://search.gleif.org/#/record/213800AB12CD34EF5678"
        );

        const { displayModel } = await resolveCanonicalFieldDisplay({
            derivedValue: derived!.value,
            primarySource: {
                type: derived!.sourceType as any,
                reference: derived!.sourceReference,
                timestamp: derived!.assertedAt,
                entityIdentifier: derived!.entityIdentifier,
                entityUrl: derived!.entityUrl,
                userName: null,
            },
            meta: { fieldNo: 3, label: "Legal Name", displayState: "HAS_VALUE" },
        });

        expect(displayModel.source?.type).toBe("GLEIF");
        expect(displayModel.source?.entityIdentifier).toBe("213800AB12CD34EF5678");
        expect(displayModel.source?.entityUrl).toBe(
            "https://search.gleif.org/#/record/213800AB12CD34EF5678"
        );
    });
});
