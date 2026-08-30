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
    const TEST_USER_ID = `usr-onp39-${timestamp}`;
    const TEST_LE_ID = `le-entity-onp39-${timestamp}`;
    const TEST_CLIENT_LE_ID = `le-onp39-${timestamp}`;

    let ccPartyAliceId: string;
    let ccPartyBobId: string;
    let ccPartyCharlieId: string;
    let ccPartyXId: string;

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
            data: {
                id: TEST_LE_ID,
                name: "ONP39 Legal Entity",
                reference: `REF-${timestamp}`
            }
        });

        await prisma.clientLE.create({
            data: {
                id: TEST_CLIENT_LE_ID,
                name: "ONP39 Test Client LE",
                legalEntityId: TEST_LE_ID
            }
        });

        // 2. Create reusable CCParties (Alice, Bob, Charlie, Party X)
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

        const partyX = await prisma.cCParty.create({
            data: {
                clientLEId: TEST_CLIENT_LE_ID,
                data: {
                    partyType: "INDIVIDUAL",
                    individual: {
                        givenName: "Xavier",
                        familyName: "Cross"
                    }
                }
            }
        });
        ccPartyXId = partyX.id;
    });

    afterAll(async () => {
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
        // Field 64 (PSCs) references Alice
        const claimA = await FieldClaimService.assertClaim({
            fieldNo: 64,
            clientLEId: TEST_CLIENT_LE_ID,
            sourceType: SourceType.USER_INPUT,
            collectionId: "PARTY_COLLECTION_64",
            instanceId: `inst-alice-64-${timestamp}`,
            valueJson: { ccPartyId: ccPartyAliceId }
        });
        await FieldClaimService.verifyClaim(claimA.id, TEST_USER_ID);

        // Field 104 (SSI callback contacts) also references Alice
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

        // Assert 3: Reusable CCParty object in database survives completely untouched
        const aliceParty = await prisma.cCParty.findUnique({
            where: { id: ccPartyAliceId }
        });
        expect(aliceParty).not.toBeNull();
        expect((aliceParty?.data as any)?.individual?.givenName).toBe("Alice");

        // Assert 4: Historical FieldClaim record in database remains preserved
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
        // Clear previous claims on field 64 for fresh isolated sub-test state
        const claimAlice = await FieldClaimService.assertClaim({
            fieldNo: 64,
            clientLEId: TEST_CLIENT_LE_ID,
            sourceType: SourceType.USER_INPUT,
            collectionId: "PARTY_COLLECTION_64",
            instanceId: `inst-r02-alice-${timestamp}`,
            valueJson: { ccPartyId: ccPartyAliceId }
        });
        await FieldClaimService.verifyClaim(claimAlice.id, TEST_USER_ID);

        const claimBob = await FieldClaimService.assertClaim({
            fieldNo: 64,
            clientLEId: TEST_CLIENT_LE_ID,
            sourceType: SourceType.USER_INPUT,
            collectionId: "PARTY_COLLECTION_64",
            instanceId: `inst-r02-bob-${timestamp}`,
            valueJson: { ccPartyId: ccPartyBobId }
        });
        await FieldClaimService.verifyClaim(claimBob.id, TEST_USER_ID);

        const claimCharlie = await FieldClaimService.assertClaim({
            fieldNo: 64,
            clientLEId: TEST_CLIENT_LE_ID,
            sourceType: SourceType.USER_INPUT,
            collectionId: "PARTY_COLLECTION_64",
            instanceId: `inst-r02-charlie-${timestamp}`,
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

    it("REF-03A: Generic single-value immutable-history contract (clearing scalar value preserves claim immutability and creates removal event)", async () => {
        // Field 45 (single-value text/scalar)
        const claimSingle = await FieldClaimService.assertClaim({
            fieldNo: 45,
            clientLEId: TEST_CLIENT_LE_ID,
            sourceType: SourceType.USER_INPUT,
            valueText: "Custom Scalar Single Value"
        });
        await FieldClaimService.verifyClaim(claimSingle.id, TEST_USER_ID);

        // Pre-condition: Field 45 resolves authoritative value
        const initialVal = await KycStateService.getAuthoritativeValue({ clientLEId: TEST_CLIENT_LE_ID }, 45);
        expect(initialVal?.value).toBe("Custom Scalar Single Value");

        // Action: Clear single-value field
        const clearRes = await clearSingleValueEntry(TEST_CLIENT_LE_ID, 45);
        expect(clearRes.success).toBe(true);

        // Assert 1: Current value disappears / resolves to empty
        const postVal = await KycStateService.getAuthoritativeValue({ clientLEId: TEST_CLIENT_LE_ID }, 45);
        expect(postVal?.value ?? null).toBeNull();

        // Assert 2 (IMMUTABLE HISTORY CONTRACT): Original claim must NOT be mutated to 'REJECTED'
        const originalClaimRecord = await prisma.fieldClaim.findUnique({
            where: { id: claimSingle.id }
        });
        expect(originalClaimRecord).not.toBeNull();
        expect(originalClaimRecord?.status).toBe("VERIFIED");

        // Assert 3 (CANONICAL REMOVAL EVENT): A new removal/tombstone/absence event exists
        const removalEvent = await prisma.fieldClaim.findFirst({
            where: {
                clientLEId: TEST_CLIENT_LE_ID,
                fieldNo: 45,
                id: { not: claimSingle.id }
            },
            orderBy: { assertedAt: "desc" }
        });
        expect(removalEvent).not.toBeNull();
    });

    it("REF-03B: Reusable single-value reference removal preserves reusable object and claim history", async () => {
        // Field 155 is a standard single-value Party field (Senior Managing Official, isMultiValue: false)
        // Field 64 is a repeating Party field (Persons of significant control, isMultiValue: true)
        // Both reference reusable Party X (Xavier Cross)

        // 1. Seed Field 155 (Single-value Field A) -> Party X
        const claimFieldA = await FieldClaimService.assertClaim({
            fieldNo: 155,
            clientLEId: TEST_CLIENT_LE_ID,
            sourceType: SourceType.USER_INPUT,
            valueJson: { ccPartyId: ccPartyXId }
        });
        await FieldClaimService.verifyClaim(claimFieldA.id, TEST_USER_ID);

        // 2. Seed Field 64 (Field B) -> Party X
        const claimFieldB = await FieldClaimService.assertClaim({
            fieldNo: 64,
            clientLEId: TEST_CLIENT_LE_ID,
            sourceType: SourceType.USER_INPUT,
            collectionId: "PARTY_COLLECTION_64",
            instanceId: `inst-px-64-${timestamp}`,
            valueJson: { ccPartyId: ccPartyXId }
        });
        await FieldClaimService.verifyClaim(claimFieldB.id, TEST_USER_ID);

        // Pre-condition: Field 155 resolves Party X, and Field 64 resolves Party X
        const valAInitial = await KycStateService.getAuthoritativeValue({ clientLEId: TEST_CLIENT_LE_ID }, 155);
        expect((valAInitial?.value as any)?.ccPartyId).toBe(ccPartyXId);

        const collBInitial = await KycStateService.getAuthoritativeCollection({ clientLEId: TEST_CLIENT_LE_ID }, 64);
        expect(collBInitial.some(c => (c.value as any)?.ccPartyId === ccPartyXId)).toBe(true);

        // Action: Remove Party X from single-value Field 155 (Field A)
        const clearRes = await clearSingleValueEntry(TEST_CLIENT_LE_ID, 155);
        expect(clearRes.success).toBe(true);

        // Assert 1: Field 155 (Field A) no longer resolves Party X
        const valAPost = await KycStateService.getAuthoritativeValue({ clientLEId: TEST_CLIENT_LE_ID }, 155);
        expect((valAPost?.value as any)?.ccPartyId ?? null).toBeNull();

        // Assert 2: Field 64 (Field B) still resolves Party X
        const collBPost = await KycStateService.getAuthoritativeCollection({ clientLEId: TEST_CLIENT_LE_ID }, 64);
        expect(collBPost.some(c => (c.value as any)?.ccPartyId === ccPartyXId)).toBe(true);

        // Assert 3: Reusable CCParty object survives unchanged in database
        const partyXRecord = await prisma.cCParty.findUnique({
            where: { id: ccPartyXId }
        });
        expect(partyXRecord).not.toBeNull();
        expect((partyXRecord?.data as any)?.individual?.givenName).toBe("Xavier");

        // Assert 4: Original Field 155 claim remains intact in history with original status
        const originalClaimRecord = await prisma.fieldClaim.findUnique({
            where: { id: claimFieldA.id }
        });
        expect(originalClaimRecord).not.toBeNull();
        expect(originalClaimRecord?.status).toBe("VERIFIED");

        // Assert 5: A new removal event exists representing the change
        const removalEvent = await prisma.fieldClaim.findFirst({
            where: {
                clientLEId: TEST_CLIENT_LE_ID,
                fieldNo: 155,
                id: { not: claimFieldA.id }
            },
            orderBy: { assertedAt: "desc" }
        });
        expect(removalEvent).not.toBeNull();
    });
});
