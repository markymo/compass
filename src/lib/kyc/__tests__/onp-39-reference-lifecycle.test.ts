import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { assertUatDbTestEnv } from "./test-env-guard";
import prisma from "@/lib/prisma";
import { KycStateService } from "@/lib/kyc/KycStateService";
import { FieldClaimService } from "@/lib/kyc/FieldClaimService";
import { removeMultiValueEntry, clearSingleValueEntry } from "@/actions/kyc-manual-update";
import { SourceType } from "@prisma/client";

let mockUserId = "usr-onp39-test";

// Mock auth so server actions can resolve a test userId
vi.mock("@/lib/auth", () => ({
    getIdentity: vi.fn().mockImplementation(() => Promise.resolve({
        userId: mockUserId,
        email: "uat+onp39@onpro.tech",
        role: "LE_ADMIN",
        orgId: "org-onp39-test"
    }))
}));

// Mock Next.js revalidatePath
vi.mock("next/cache", () => ({
    revalidatePath: vi.fn()
}));

describe("Track A: ONP-39 Reference Lifecycle (DB Integration)", () => {
    const timestamp = Date.now();
    const TEST_ORG_ID = `org-onp39-${timestamp}`;
    const TEST_USER_ID = `usr-onp39-${timestamp}`;
    const TEST_LE_ID = `le-entity-onp39-${timestamp}`;
    const TEST_CLIENT_LE_ID = `le-onp39-${timestamp}`;

    let ccPartyAliceId: string;
    let ccPartyBobId: string;
    let ccPartyCharlieId: string;

    beforeAll(async () => {
        assertUatDbTestEnv();
        mockUserId = TEST_USER_ID;

        // 1. Seed test user, LegalEntity and ClientLE
        await prisma.user.create({
            data: {
                id: TEST_USER_ID,
                email: `onp39-${timestamp}@test.onpro.tech`,
                name: "ONP39 Test User"
            }
        });
        await prisma.legalEntity.create({
            data: { id: TEST_LE_ID, name: "ONP39 Test Legal Entity", reference: `REF-${timestamp}` }
        });
        await prisma.clientLE.create({
            data: {
                id: TEST_CLIENT_LE_ID,
                name: "ONP39 Test Client LE",
                legalEntityId: TEST_LE_ID
            }
        });

        // 2. Create reusable CCParties (Alice, Bob, Charlie)
        const alice = await prisma.cCParty.create({
            data: {
                clientLEId: TEST_CLIENT_LE_ID,
                data: {
                    partyType: "INDIVIDUAL",
                    individual: {
                        givenName: "Alice",
                        familyName: "Smith"
                    }
                }
            }
        });
        ccPartyAliceId = alice.id;

        const bob = await prisma.cCParty.create({
            data: {
                clientLEId: TEST_CLIENT_LE_ID,
                data: {
                    partyType: "INDIVIDUAL",
                    individual: {
                        givenName: "Bob",
                        familyName: "Jones"
                    }
                }
            }
        });
        ccPartyBobId = bob.id;

        const charlie = await prisma.cCParty.create({
            data: {
                clientLEId: TEST_CLIENT_LE_ID,
                data: {
                    partyType: "INDIVIDUAL",
                    individual: {
                        givenName: "Charlie",
                        familyName: "Brown"
                    }
                }
            }
        });
        ccPartyCharlieId = charlie.id;
    });

    afterAll(async () => {
        // Deterministic cleanup
        try {
            await prisma.fieldClaim.deleteMany({
                where: { clientLEId: TEST_CLIENT_LE_ID }
            });
            await prisma.cCParty.deleteMany({
                where: { clientLEId: TEST_CLIENT_LE_ID }
            });
            await prisma.clientLE.deleteMany({
                where: { id: TEST_CLIENT_LE_ID }
            });
            await prisma.legalEntity.deleteMany({
                where: { id: TEST_LE_ID }
            });
            await prisma.user.deleteMany({
                where: { id: TEST_USER_ID }
            });
        } catch (e) {
            console.error("Cleanup error in onp-39-reference-lifecycle.test.ts:", e);
        }
    });

    it("REF-01: Remove one Party reference (repeating) leaves CCParty and other field references intact", async () => {
        // Field 64 (repeating party) and Field 104 (repeating party) both reference Alice
        const claimA = await FieldClaimService.assertClaim({
            fieldNo: 64,
            clientLEId: TEST_CLIENT_LE_ID,
            sourceType: SourceType.USER_INPUT,
            collectionId: "PARTY_COLLECTION_64",
            instanceId: `inst-alice-64-${timestamp}`,
            valueJson: { ccPartyId: ccPartyAliceId }
        });
        await FieldClaimService.verifyClaim(claimA.id, TEST_USER_ID);

        const claimB = await FieldClaimService.assertClaim({
            fieldNo: 104,
            clientLEId: TEST_CLIENT_LE_ID,
            sourceType: SourceType.USER_INPUT,
            collectionId: "PARTY_COLLECTION_104",
            instanceId: `inst-alice-104-${timestamp}`,
            valueJson: { ccPartyId: ccPartyAliceId }
        });
        await FieldClaimService.verifyClaim(claimB.id, TEST_USER_ID);

        // Pre-condition check: Both fields resolve Alice
        const collAInitial = await KycStateService.getAuthoritativeCollection({ clientLEId: TEST_CLIENT_LE_ID }, 64);
        const collBInitial = await KycStateService.getAuthoritativeCollection({ clientLEId: TEST_CLIENT_LE_ID }, 104);
        expect(collAInitial.length).toBeGreaterThan(0);
        expect(collBInitial.length).toBeGreaterThan(0);

        // Action: Remove Alice from Field 64
        const removeRes = await removeMultiValueEntry(TEST_CLIENT_LE_ID, 64, claimA.id);
        expect(removeRes.success).toBe(true);

        // Assert 1: Field 64 no longer resolves Alice
        const collAPost = await KycStateService.getAuthoritativeCollection({ clientLEId: TEST_CLIENT_LE_ID }, 64);
        const aliceInField64 = collAPost.some(item => (item.value as any)?.ccPartyId === ccPartyAliceId);
        expect(aliceInField64).toBe(false);

        // Assert 2: Field 104 still resolves Alice
        const collBPost = await KycStateService.getAuthoritativeCollection({ clientLEId: TEST_CLIENT_LE_ID }, 104);
        const aliceInField104 = collBPost.some(item => (item.value as any)?.ccPartyId === ccPartyAliceId);
        expect(aliceInField104).toBe(true);

        // Assert 3: Alice CCParty object still exists in database
        const aliceParty = await prisma.cCParty.findUnique({
            where: { id: ccPartyAliceId }
        });
        expect(aliceParty).not.toBeNull();

        // Assert 4: Historical Field 64 claimA still exists in database (immutable history)
        const claimARecord = await prisma.fieldClaim.findUnique({
            where: { id: claimA.id }
        });
        expect(claimARecord).not.toBeNull();
        expect(claimARecord?.status).toBe("VERIFIED"); // status should remain VERIFIED

        // Assert 5: Tombstone claim exists in database for Field 64
        const tombstone = await prisma.fieldClaim.findFirst({
            where: {
                clientLEId: TEST_CLIENT_LE_ID,
                fieldNo: 64,
                instanceId: claimA.instanceId
            },
            orderBy: { assertedAt: "desc" }
        });
        expect(tombstone).not.toBeNull();
        expect((tombstone?.valueJson as any)?.tombstone).toBe(true);
    });

    it("REF-02: Removing one entry from repeating field (Alice, Bob, Charlie) leaves remaining entries and history intact", async () => {
        // Field 64 contains Alice (re-added), Bob, Charlie
        const claimAlice = await FieldClaimService.assertClaim({
            fieldNo: 64,
            clientLEId: TEST_CLIENT_LE_ID,
            sourceType: SourceType.USER_INPUT,
            collectionId: "PARTY_COLLECTION_64",
            instanceId: `inst-alice2-64-${timestamp}`,
            valueJson: { ccPartyId: ccPartyAliceId }
        });
        await FieldClaimService.verifyClaim(claimAlice.id, TEST_USER_ID);

        const claimBob = await FieldClaimService.assertClaim({
            fieldNo: 64,
            clientLEId: TEST_CLIENT_LE_ID,
            sourceType: SourceType.USER_INPUT,
            collectionId: "PARTY_COLLECTION_64",
            instanceId: `inst-bob-64-${timestamp}`,
            valueJson: { ccPartyId: ccPartyBobId }
        });
        await FieldClaimService.verifyClaim(claimBob.id, TEST_USER_ID);

        const claimCharlie = await FieldClaimService.assertClaim({
            fieldNo: 64,
            clientLEId: TEST_CLIENT_LE_ID,
            sourceType: SourceType.USER_INPUT,
            collectionId: "PARTY_COLLECTION_64",
            instanceId: `inst-charlie-64-${timestamp}`,
            valueJson: { ccPartyId: ccPartyCharlieId }
        });
        await FieldClaimService.verifyClaim(claimCharlie.id, TEST_USER_ID);

        // Pre-condition: Field 64 resolves Alice, Bob, Charlie
        const preColl = await KycStateService.getAuthoritativeCollection({ clientLEId: TEST_CLIENT_LE_ID }, 64);
        const ids = preColl.map(c => (c.value as any)?.ccPartyId);
        expect(ids).toContain(ccPartyAliceId);
        expect(ids).toContain(ccPartyBobId);
        expect(ids).toContain(ccPartyCharlieId);

        // Action: Remove Bob
        const removeRes = await removeMultiValueEntry(TEST_CLIENT_LE_ID, 64, claimBob.id);
        expect(removeRes.success).toBe(true);

        // Assert 1: Alice and Charlie remain, Bob is absent
        const postColl = await KycStateService.getAuthoritativeCollection({ clientLEId: TEST_CLIENT_LE_ID }, 64);
        const postIds = postColl.map(c => (c.value as any)?.ccPartyId);
        expect(postIds).toContain(ccPartyAliceId);
        expect(postIds).toContain(ccPartyCharlieId);
        expect(postIds).not.toContain(ccPartyBobId);

        // Assert 2: Bob CCParty object survives
        const bobParty = await prisma.cCParty.findUnique({
            where: { id: ccPartyBobId }
        });
        expect(bobParty).not.toBeNull();

        // Assert 3: Bob's historical claim survives unchanged
        const bobClaimRecord = await prisma.fieldClaim.findUnique({
            where: { id: claimBob.id }
        });
        expect(bobClaimRecord).not.toBeNull();
        expect(bobClaimRecord?.status).toBe("VERIFIED");
    });

    it("REF-03: Single-value field removal preserves claim immutability (does NOT mutate claim to REJECTED)", async () => {
        // Field 45 (single-value text/scalar or non-repeating party reference)
        const claimSingle = await FieldClaimService.assertClaim({
            fieldNo: 45,
            clientLEId: TEST_CLIENT_LE_ID,
            sourceType: SourceType.USER_INPUT,
            valueText: "Custom Single Value"
        });
        await FieldClaimService.verifyClaim(claimSingle.id, TEST_USER_ID);

        // Pre-condition: Field 45 resolves authoritative value
        const initialVal = await KycStateService.getAuthoritativeValue({ clientLEId: TEST_CLIENT_LE_ID }, 45);
        expect(initialVal?.value).toBe("Custom Single Value");

        // Action: Clear single-value field
        const clearRes = await clearSingleValueEntry(TEST_CLIENT_LE_ID, 45);
        expect(clearRes.success).toBe(true);

        // Assert 1: Field 45 resolves to empty / blank state
        const postVal = await KycStateService.getAuthoritativeValue({ clientLEId: TEST_CLIENT_LE_ID }, 45);
        expect(postVal?.value ?? null).toBeNull();

        // Assert 2 (IMMUTABLE HISTORY CONTRACT): Original claim must NOT be mutated to 'REJECTED'
        // Prior claims must remain immutable historical records with their original status preserved.
        const originalClaimRecord = await prisma.fieldClaim.findUnique({
            where: { id: claimSingle.id }
        });
        expect(originalClaimRecord).not.toBeNull();
        expect(originalClaimRecord?.status).toBe("VERIFIED");
    });
});
