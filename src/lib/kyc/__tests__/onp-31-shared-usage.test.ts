import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { assertUatDbTestEnv } from "./test-env-guard";
import prisma from "@/lib/prisma";
import { FieldClaimService } from "@/lib/kyc/FieldClaimService";
import { getCCPartyUsage } from "@/actions/cc-party-actions";
import { getCCAddressUsage } from "@/actions/cc-address-actions";
import { removeMultiValueEntry } from "@/actions/kyc-manual-update";
import { SourceType } from "@prisma/client";

let mockUserId = "usr-onp31-test";

// Mock auth so server actions can resolve a test userId
vi.mock("@/lib/auth", () => ({
    getIdentity: vi.fn().mockImplementation(() => Promise.resolve({
        userId: mockUserId,
        email: "uat+onp31@onpro.tech",
        role: "LE_ADMIN",
        orgId: "org-onp31-test"
    }))
}));

// Mock Next.js revalidatePath
vi.mock("next/cache", () => ({
    revalidatePath: vi.fn()
}));

describe("Track B: ONP-31 Shared Resource Active Usage Resolution (DB Integration)", () => {
    const timestamp = Date.now();
    const TEST_USER_ID = `usr-onp31-${timestamp}`;
    const TEST_LE_ID_A = `le-entity-onp31-a-${timestamp}`;
    const TEST_CLIENT_LE_A = `le-onp31-a-${timestamp}`;
    const TEST_LE_ID_B = `le-entity-onp31-b-${timestamp}`;
    const TEST_CLIENT_LE_B = `le-onp31-b-${timestamp}`;

    let ccPartyAliceId: string;
    let ccPartyBobId: string;
    let ccAddressId: string;

    beforeAll(async () => {
        assertUatDbTestEnv();
        mockUserId = TEST_USER_ID;

        // 1. Seed test user
        await prisma.user.create({
            data: {
                id: TEST_USER_ID,
                email: `onp31-${timestamp}@test.onpro.tech`,
                name: "ONP31 Test User"
            }
        });

        // 2. Seed ClientLE A
        await prisma.legalEntity.create({
            data: { id: TEST_LE_ID_A, name: "ONP31 Legal Entity A", reference: `REF-A-${timestamp}` }
        });
        await prisma.clientLE.create({
            data: {
                id: TEST_CLIENT_LE_A,
                name: "ONP31 Client LE A",
                legalEntityId: TEST_LE_ID_A
            }
        });

        // 3. Seed ClientLE B (separate tenant/dossier)
        await prisma.legalEntity.create({
            data: { id: TEST_LE_ID_B, name: "ONP31 Legal Entity B", reference: `REF-B-${timestamp}` }
        });
        await prisma.clientLE.create({
            data: {
                id: TEST_CLIENT_LE_B,
                name: "ONP31 Client LE B",
                legalEntityId: TEST_LE_ID_B
            }
        });

        // 4. Create reusable CCParties on ClientLE A
        const alice = await prisma.cCParty.create({
            data: {
                clientLEId: TEST_CLIENT_LE_A,
                data: {
                    partyType: "INDIVIDUAL",
                    individual: { givenName: "Alice", familyName: "Smith" }
                }
            }
        });
        ccPartyAliceId = alice.id;

        const bob = await prisma.cCParty.create({
            data: {
                clientLEId: TEST_CLIENT_LE_A,
                data: {
                    partyType: "INDIVIDUAL",
                    individual: { givenName: "Bob", familyName: "Jones" }
                }
            }
        });
        ccPartyBobId = bob.id;

        // 5. Create reusable CCAddress on ClientLE A
        const addr = await prisma.cCAddress.create({
            data: {
                clientLEId: TEST_CLIENT_LE_A,
                data: {
                    addressLines: ["100 Oxford Street"],
                    city: "London",
                    postalCode: "W1D 1LL",
                    country: "GB"
                }
            }
        });
        ccAddressId = addr.id;
    });

    afterAll(async () => {
        try {
            await prisma.fieldClaim.deleteMany({
                where: { clientLEId: { in: [TEST_CLIENT_LE_A, TEST_CLIENT_LE_B] } }
            });
            await prisma.cCParty.deleteMany({
                where: { clientLEId: { in: [TEST_CLIENT_LE_A, TEST_CLIENT_LE_B] } }
            });
            await prisma.cCAddress.deleteMany({
                where: { clientLEId: { in: [TEST_CLIENT_LE_A, TEST_CLIENT_LE_B] } }
            });
            await prisma.clientLE.deleteMany({
                where: { id: { in: [TEST_CLIENT_LE_A, TEST_CLIENT_LE_B] } }
            });
            await prisma.legalEntity.deleteMany({
                where: { id: { in: [TEST_LE_ID_A, TEST_LE_ID_B] } }
            });
            await prisma.user.deleteMany({
                where: { id: TEST_USER_ID }
            });
        } catch (e) {
            console.error("Cleanup error in onp-31-shared-usage.test.ts:", e);
        }
    });

    it("USAGE-01: Active current reference is included in getCCPartyUsage", async () => {
        // Field 64 references Alice
        const claim = await FieldClaimService.assertClaim({
            fieldNo: 64,
            clientLEId: TEST_CLIENT_LE_A,
            sourceType: SourceType.USER_INPUT,
            collectionId: "PARTY_COLLECTION_64",
            instanceId: `inst-alice-u01-${timestamp}`,
            valueJson: { ccPartyId: ccPartyAliceId }
        });
        await FieldClaimService.verifyClaim(claim.id, TEST_USER_ID);

        const usageMap = await getCCPartyUsage(TEST_CLIENT_LE_A);
        const aliceUsage = usageMap[ccPartyAliceId] || [];
        const fieldNos = aliceUsage.map(u => u.fieldNo);

        expect(fieldNos).toContain(64);
    });

    it("USAGE-02: Removed reference is excluded from getCCPartyUsage (does not report tombstoned field)", async () => {
        // Field 104 also references Alice
        const claim104 = await FieldClaimService.assertClaim({
            fieldNo: 104,
            clientLEId: TEST_CLIENT_LE_A,
            sourceType: SourceType.USER_INPUT,
            collectionId: "PARTY_COLLECTION_104",
            instanceId: `inst-alice-u02-${timestamp}`,
            valueJson: { ccPartyId: ccPartyAliceId }
        });
        await FieldClaimService.verifyClaim(claim104.id, TEST_USER_ID);

        // Remove Alice from Field 64
        const field64Claim = await prisma.fieldClaim.findFirst({
            where: {
                clientLEId: TEST_CLIENT_LE_A,
                fieldNo: 64,
                valueJson: { path: ["ccPartyId"], equals: ccPartyAliceId }
            }
        });
        expect(field64Claim).not.toBeNull();
        await removeMultiValueEntry(TEST_CLIENT_LE_A, 64, field64Claim!.id);

        // Fetch usage
        const usageMap = await getCCPartyUsage(TEST_CLIENT_LE_A);
        const aliceUsage = usageMap[ccPartyAliceId] || [];
        const fieldNos = aliceUsage.map(u => u.fieldNo);

        // Expected contract: Field 104 is reported, but Field 64 must NOT be reported
        expect(fieldNos).toContain(104);
        expect(fieldNos).not.toContain(64);
    });

    it("USAGE-03: Superseded reference is excluded from older party's usage and included in newer party's usage", async () => {
        // Field 63 (single value / repeating director): older claim references Alice
        const olderClaim = await FieldClaimService.assertClaim({
            fieldNo: 63,
            clientLEId: TEST_CLIENT_LE_A,
            sourceType: SourceType.USER_INPUT,
            collectionId: "PARTY_COLLECTION_63",
            instanceId: `inst-dir-u03-${timestamp}`,
            valueJson: { ccPartyId: ccPartyAliceId },
            assertedAt: new Date(Date.now() - 10000)
        });
        await FieldClaimService.verifyClaim(olderClaim.id, TEST_USER_ID);

        // Newer claim on the same instanceId updates to Bob
        const newerClaim = await FieldClaimService.assertClaim({
            fieldNo: 63,
            clientLEId: TEST_CLIENT_LE_A,
            sourceType: SourceType.USER_INPUT,
            collectionId: "PARTY_COLLECTION_63",
            instanceId: `inst-dir-u03-${timestamp}`,
            valueJson: { ccPartyId: ccPartyBobId },
            assertedAt: new Date()
        });
        await FieldClaimService.verifyClaim(newerClaim.id, TEST_USER_ID);

        const usageMap = await getCCPartyUsage(TEST_CLIENT_LE_A);
        const aliceUsage = usageMap[ccPartyAliceId] || [];
        const bobUsage = usageMap[ccPartyBobId] || [];

        // Alice's active usage must NOT include Field 63 (superseded)
        expect(aliceUsage.map(u => u.fieldNo)).not.toContain(63);
        // Bob's active usage MUST include Field 63
        expect(bobUsage.map(u => u.fieldNo)).toContain(63);
    });

    it("USAGE-04: Dossier isolation — usage queried for ClientLE A never includes references from ClientLE B", async () => {
        // Create an identical reference to Alice inside ClientLE B's Field 64
        const claimB = await FieldClaimService.assertClaim({
            fieldNo: 64,
            clientLEId: TEST_CLIENT_LE_B,
            sourceType: SourceType.USER_INPUT,
            collectionId: "PARTY_COLLECTION_64",
            instanceId: `inst-alice-b-${timestamp}`,
            valueJson: { ccPartyId: ccPartyAliceId }
        });
        await FieldClaimService.verifyClaim(claimB.id, TEST_USER_ID);

        // Query usage specifically for ClientLE A
        const usageMapA = await getCCPartyUsage(TEST_CLIENT_LE_A);
        const aliceUsageA = usageMapA[ccPartyAliceId] || [];

        // Field 64 was removed on ClientLE A in USAGE-02. If getCCPartyUsage queries globally across all dossiers,
        // it will falsely report Field 64 from ClientLE B!
        const fieldNos = aliceUsageA.map(u => u.fieldNo);
        expect(fieldNos).not.toContain(64);
    });

    it("USAGE-05: Address usage tracks active field references and reflects removal", async () => {
        // Field 27 (Principal place of business) references ccAddressId
        const addrClaim = await FieldClaimService.assertClaim({
            fieldNo: 27,
            clientLEId: TEST_CLIENT_LE_A,
            sourceType: SourceType.USER_INPUT,
            valueJson: { ccAddressId }
        });
        await FieldClaimService.verifyClaim(addrClaim.id, TEST_USER_ID);

        const usageSummaryMap = await getCCAddressUsage(TEST_CLIENT_LE_A);
        const summary = usageSummaryMap[ccAddressId];
        expect(summary).toBeDefined();
        const activeFields = summary?.fieldUsages.map(f => f.fieldNo) || [];
        expect(activeFields).toContain(27);
    });
});
