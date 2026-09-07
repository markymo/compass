import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import { assertUatDbTestEnv } from "./test-env-guard";
import prisma from "@/lib/prisma";
import { FieldClaimService } from "@/lib/kyc/FieldClaimService";
import { getCCPartyUsage } from "@/actions/cc-party-actions";
import { getCCAddressUsage } from "@/actions/cc-address-actions";
import { removeMultiValueEntry, clearSingleValueEntry } from "@/actions/kyc-manual-update";
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

describe("Track B: ONP-31 & ONP-96 Shared Resource Usage & Authorization (DB Integration)", () => {
    const globalTimestamp = Date.now();
    const TEST_USER_ID = `usr-onp31-${globalTimestamp}`;
    const UNASSIGNED_USER_ID = `usr-onp31-unauth-${globalTimestamp}`;
    let createdClientLEIds: string[] = [];
    let createdLegalEntityIds: string[] = [];

    beforeAll(async () => {
        assertUatDbTestEnv();
        mockUserId = TEST_USER_ID;

        // Seed authorized test user
        await prisma.user.create({
            data: {
                id: TEST_USER_ID,
                email: `onp31-auth-${globalTimestamp}@test.onpro.tech`,
                name: "ONP31 Authorized User"
            }
        });

        // Seed unassigned user with no memberships
        await prisma.user.create({
            data: {
                id: UNASSIGNED_USER_ID,
                email: `onp31-unauth-${globalTimestamp}@test.onpro.tech`,
                name: "ONP31 Unassigned User"
            }
        });
    });

    afterAll(async () => {
        try {
            if (createdClientLEIds.length > 0) {
                await prisma.membership.deleteMany({
                    where: { clientLEId: { in: createdClientLEIds } }
                });
                await prisma.fieldClaim.deleteMany({
                    where: { clientLEId: { in: createdClientLEIds } }
                });
                await prisma.cCParty.deleteMany({
                    where: { clientLEId: { in: createdClientLEIds } }
                });
                await prisma.cCAddress.deleteMany({
                    where: { clientLEId: { in: createdClientLEIds } }
                });
                await prisma.clientLE.deleteMany({
                    where: { id: { in: createdClientLEIds } }
                });
            }
            if (createdLegalEntityIds.length > 0) {
                await prisma.legalEntity.deleteMany({
                    where: { id: { in: createdLegalEntityIds } }
                });
            }
            await prisma.membership.deleteMany({
                where: { userId: { in: [TEST_USER_ID, UNASSIGNED_USER_ID] } }
            });
            await prisma.user.deleteMany({
                where: { id: { in: [TEST_USER_ID, UNASSIGNED_USER_ID] } }
            });
        } catch (e) {
            console.error("Cleanup error in onp-31-shared-usage.test.ts:", e);
        }
    });

    // Helper to create fully isolated dossier fixture for an individual test
    async function createIsolatedDossier(suffix: string) {
        const uniqueId = `${globalTimestamp}-${suffix}-${Math.random().toString(36).substring(2, 7)}`;
        const leId = `le-entity-onp31-${uniqueId}`;
        const clientLEId = `le-onp31-${uniqueId}`;

        await prisma.legalEntity.create({
            data: { id: leId, name: `ONP31 LE ${suffix}`, reference: `REF-${uniqueId}` }
        });
        await prisma.clientLE.create({
            data: { id: clientLEId, name: `ONP31 ClientLE ${suffix}`, legalEntityId: leId }
        });

        // Grant test user LE_ADMIN membership on this ClientLE
        await prisma.membership.create({
            data: {
                userId: TEST_USER_ID,
                clientLEId: clientLEId,
                role: "LE_ADMIN"
            }
        });

        createdLegalEntityIds.push(leId);
        createdClientLEIds.push(clientLEId);

        return { leId, clientLEId, uniqueId };
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // PARTY USAGE TESTS (Fully Independent)
    // ─────────────────────────────────────────────────────────────────────────────

    it("PARTY-USAGE-01: Active current party reference is reported in getCCPartyUsage", async () => {
        mockUserId = TEST_USER_ID;
        const { clientLEId, uniqueId } = await createIsolatedDossier("pu01");

        const alice = await prisma.cCParty.create({
            data: {
                clientLEId,
                data: {
                    partyType: "INDIVIDUAL",
                    individual: { givenName: "Alice", familyName: "Smith" }
                }
            }
        });

        const claim = await FieldClaimService.assertClaim({
            fieldNo: 64,
            clientLEId,
            sourceType: SourceType.USER_INPUT,
            collectionId: "PARTY_COLLECTION_64",
            instanceId: `inst-alice-pu01-${uniqueId}`,
            valueJson: { ccPartyId: alice.id }
        });
        await FieldClaimService.verifyClaim(claim.id, TEST_USER_ID);

        const usageMap = await getCCPartyUsage(clientLEId);
        const aliceUsage = usageMap[alice.id] || [];
        const fieldNos = aliceUsage.map(u => u.fieldNo);

        expect(fieldNos).toContain(64);
    });

    it("PARTY-USAGE-02: Tombstoned/removed party reference is NOT reported in getCCPartyUsage", async () => {
        mockUserId = TEST_USER_ID;
        const { clientLEId, uniqueId } = await createIsolatedDossier("pu02");

        const alice = await prisma.cCParty.create({
            data: {
                clientLEId,
                data: {
                    partyType: "INDIVIDUAL",
                    individual: { givenName: "Alice", familyName: "Smith" }
                }
            }
        });

        // Add Alice to Field 64
        const claim64 = await FieldClaimService.assertClaim({
            fieldNo: 64,
            clientLEId,
            sourceType: SourceType.USER_INPUT,
            collectionId: "PARTY_COLLECTION_64",
            instanceId: `inst-alice-64-${uniqueId}`,
            valueJson: { ccPartyId: alice.id }
        });
        await FieldClaimService.verifyClaim(claim64.id, TEST_USER_ID);

        // Add Alice to Field 104
        const claim104 = await FieldClaimService.assertClaim({
            fieldNo: 104,
            clientLEId,
            sourceType: SourceType.USER_INPUT,
            collectionId: "PARTY_COLLECTION_104",
            instanceId: `inst-alice-104-${uniqueId}`,
            valueJson: { ccPartyId: alice.id }
        });
        await FieldClaimService.verifyClaim(claim104.id, TEST_USER_ID);

        // Remove Alice from Field 64
        await removeMultiValueEntry(clientLEId, 64, claim64.id);

        const usageMap = await getCCPartyUsage(clientLEId);
        const aliceUsage = usageMap[alice.id] || [];
        const fieldNos = aliceUsage.map(u => u.fieldNo);

        // Expected contract: Field 104 is reported, but removed Field 64 is NOT reported
        expect(fieldNos).toContain(104);
        expect(fieldNos).not.toContain(64);
    });

    it("PARTY-USAGE-03: Superseded Party A reference is NOT reported after Party B becomes authoritative", async () => {
        mockUserId = TEST_USER_ID;
        const { clientLEId, uniqueId } = await createIsolatedDossier("pu03");

        const alice = await prisma.cCParty.create({
            data: {
                clientLEId,
                data: {
                    partyType: "INDIVIDUAL",
                    individual: { givenName: "Alice", familyName: "Smith" }
                }
            }
        });

        const bob = await prisma.cCParty.create({
            data: {
                clientLEId,
                data: {
                    partyType: "INDIVIDUAL",
                    individual: { givenName: "Bob", familyName: "Jones" }
                }
            }
        });

        const instanceId = `inst-dir-${uniqueId}`;

        // Older claim references Alice
        const olderClaim = await FieldClaimService.assertClaim({
            fieldNo: 63,
            clientLEId,
            sourceType: SourceType.USER_INPUT,
            collectionId: "PARTY_COLLECTION_63",
            instanceId,
            valueJson: { ccPartyId: alice.id },
            assertedAt: new Date(Date.now() - 10000)
        });
        await FieldClaimService.verifyClaim(olderClaim.id, TEST_USER_ID);

        // Newer claim on the same instanceId updates value to Bob
        const newerClaim = await FieldClaimService.assertClaim({
            fieldNo: 63,
            clientLEId,
            sourceType: SourceType.USER_INPUT,
            collectionId: "PARTY_COLLECTION_63",
            instanceId,
            valueJson: { ccPartyId: bob.id },
            assertedAt: new Date()
        });
        await FieldClaimService.verifyClaim(newerClaim.id, TEST_USER_ID);

        const usageMap = await getCCPartyUsage(clientLEId);
        const aliceUsage = usageMap[alice.id] || [];
        const bobUsage = usageMap[bob.id] || [];

        // Alice's active usage must NOT include Field 63 (superseded)
        expect(aliceUsage.map(u => u.fieldNo)).not.toContain(63);
        // Bob's active usage MUST include Field 63
        expect(bobUsage.map(u => u.fieldNo)).toContain(63);
    });

    it("PARTY-USAGE-04: Dossier isolation — usage requested for ClientLE A never exposes unrelated Party IDs or usage from ClientLE B", async () => {
        mockUserId = TEST_USER_ID;
        const dossierA = await createIsolatedDossier("pu04-a");
        const dossierB = await createIsolatedDossier("pu04-b");

        // Party A exclusively in Dossier A
        const partyA = await prisma.cCParty.create({
            data: {
                clientLEId: dossierA.clientLEId,
                data: {
                    partyType: "INDIVIDUAL",
                    individual: { givenName: "Party", familyName: "InA" }
                }
            }
        });
        const claimA = await FieldClaimService.assertClaim({
            fieldNo: 64,
            clientLEId: dossierA.clientLEId,
            sourceType: SourceType.USER_INPUT,
            collectionId: "PARTY_COLLECTION_64",
            instanceId: `inst-pu04a-${dossierA.uniqueId}`,
            valueJson: { ccPartyId: partyA.id }
        });
        await FieldClaimService.verifyClaim(claimA.id, TEST_USER_ID);

        // Party B exclusively in Dossier B
        const partyB = await prisma.cCParty.create({
            data: {
                clientLEId: dossierB.clientLEId,
                data: {
                    partyType: "INDIVIDUAL",
                    individual: { givenName: "Party", familyName: "InB" }
                }
            }
        });
        const claimB = await FieldClaimService.assertClaim({
            fieldNo: 64,
            clientLEId: dossierB.clientLEId,
            sourceType: SourceType.USER_INPUT,
            collectionId: "PARTY_COLLECTION_64",
            instanceId: `inst-pu04b-${dossierB.uniqueId}`,
            valueJson: { ccPartyId: partyB.id }
        });
        await FieldClaimService.verifyClaim(claimB.id, TEST_USER_ID);

        // Query usage specifically for Dossier A
        const usageMapA = await getCCPartyUsage(dossierA.clientLEId);

        // Assert 1: Dossier A's party is present
        expect(usageMapA[partyA.id]).toBeDefined();

        // Assert 2 (DOSSIER ISOLATION): Dossier B's party must NOT exist in Dossier A's returned usage map
        expect(usageMapA[partyB.id]).toBeUndefined();
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // ONP-96 AUTHORIZATION TESTS
    // ─────────────────────────────────────────────────────────────────────────────

    it("AUTH-01: Authorized caller with ClientLE membership can obtain party and address usage", async () => {
        mockUserId = TEST_USER_ID;
        const { clientLEId } = await createIsolatedDossier("auth01");

        const partyUsage = await getCCPartyUsage(clientLEId);
        expect(partyUsage).toBeDefined();

        const addressUsage = await getCCAddressUsage(clientLEId);
        expect(addressUsage).toBeDefined();
    });

    it("AUTH-02: Unauthorized caller without membership in ClientLE is rejected from calling usage actions", async () => {
        const { clientLEId } = await createIsolatedDossier("auth02");

        // Switch to unassigned user who has NO membership in this clientLE
        mockUserId = UNASSIGNED_USER_ID;

        // Calling getCCPartyUsage directly for an unauthorized clientLEId must reject / throw Unauthorized
        await expect(getCCPartyUsage(clientLEId)).rejects.toThrow(/Unauthorized/i);
        await expect(getCCAddressUsage(clientLEId)).rejects.toThrow(/Unauthorized/i);
    });

    it("AUTH-03: Being logged in alone without ClientLE authorization boundary is insufficient", async () => {
        const { clientLEId } = await createIsolatedDossier("auth03");

        // User is authenticated (valid userId), but NOT a member of this dossier
        mockUserId = UNASSIGNED_USER_ID;

        await expect(getCCPartyUsage(clientLEId)).rejects.toThrow(/Unauthorized/i);
        await expect(getCCAddressUsage(clientLEId)).rejects.toThrow(/Unauthorized/i);
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // ADDRESS USAGE PARITY TESTS
    // ─────────────────────────────────────────────────────────────────────────────

    it("ADDRESS-USAGE-01: Active direct field reference is reported in getCCAddressUsage", async () => {
        mockUserId = TEST_USER_ID;
        const { clientLEId, uniqueId } = await createIsolatedDossier("au01");

        const addr = await prisma.cCAddress.create({
            data: {
                clientLEId,
                data: {
                    addressLines: ["221B Baker Street"],
                    city: "London",
                    postalCode: "NW1 6XE",
                    country: "GB"
                }
            }
        });

        // Field 138 (Registered address, isMultiValue: false)
        const claim = await FieldClaimService.assertClaim({
            fieldNo: 138,
            clientLEId,
            sourceType: SourceType.USER_INPUT,
            valueJson: { ccAddressId: addr.id }
        });
        await FieldClaimService.verifyClaim(claim.id, TEST_USER_ID);

        const usageMap = await getCCAddressUsage(clientLEId);
        const summary = usageMap[addr.id];
        expect(summary).toBeDefined();
        const activeFields = summary?.fieldUsages.map(f => f.fieldNo) || [];
        expect(activeFields).toContain(138);
    });

    it("ADDRESS-USAGE-02: Superseded direct address reference is NOT reported for older address and IS reported for newer address", async () => {
        mockUserId = TEST_USER_ID;
        const { clientLEId, uniqueId } = await createIsolatedDossier("au02");

        const addrOld = await prisma.cCAddress.create({
            data: {
                clientLEId,
                data: {
                    addressLines: ["10 Old Bond Street"],
                    city: "London",
                    postalCode: "W1S 4PD",
                    country: "GB"
                }
            }
        });

        const addrNew = await prisma.cCAddress.create({
            data: {
                clientLEId,
                data: {
                    addressLines: ["20 New Bond Street"],
                    city: "London",
                    postalCode: "W1S 2UE",
                    country: "GB"
                }
            }
        });

        // Field 138 historically referenced addrOld
        const olderClaim = await FieldClaimService.assertClaim({
            fieldNo: 138,
            clientLEId,
            sourceType: SourceType.USER_INPUT,
            valueJson: { ccAddressId: addrOld.id },
            assertedAt: new Date(Date.now() - 10000)
        });
        await FieldClaimService.verifyClaim(olderClaim.id, TEST_USER_ID);

        // Newer claim on Field 138 updates to addrNew
        const newerClaim = await FieldClaimService.assertClaim({
            fieldNo: 138,
            clientLEId,
            sourceType: SourceType.USER_INPUT,
            valueJson: { ccAddressId: addrNew.id },
            assertedAt: new Date()
        });
        await FieldClaimService.verifyClaim(newerClaim.id, TEST_USER_ID);

        const usageMap = await getCCAddressUsage(clientLEId);
        const oldSummary = usageMap[addrOld.id];
        const newSummary = usageMap[addrNew.id];

        const oldFields = oldSummary?.fieldUsages.map(f => f.fieldNo) || [];
        const newFields = newSummary?.fieldUsages.map(f => f.fieldNo) || [];

        // Address Old must NOT report Field 138
        expect(oldFields).not.toContain(138);
        // Address New MUST report Field 138
        expect(newFields).toContain(138);
    });

    it("ADDRESS-USAGE-03: Removed address reference is excluded from current usage while preserving historical claim", async () => {
        mockUserId = TEST_USER_ID;
        const { clientLEId, uniqueId } = await createIsolatedDossier("au03");

        const addr = await prisma.cCAddress.create({
            data: {
                clientLEId,
                data: {
                    addressLines: ["1 Fleet Street"],
                    city: "London",
                    postalCode: "EC4Y 1AA",
                    country: "GB"
                }
            }
        });

        // Field 138 references addr
        const claim = await FieldClaimService.assertClaim({
            fieldNo: 138,
            clientLEId,
            sourceType: SourceType.USER_INPUT,
            valueJson: { ccAddressId: addr.id }
        });
        await FieldClaimService.verifyClaim(claim.id, TEST_USER_ID);

        // Remove address reference
        await clearSingleValueEntry(clientLEId, 138);

        const usageMap = await getCCAddressUsage(clientLEId);
        const summary = usageMap[addr.id];
        const activeFields = summary?.fieldUsages.map(f => f.fieldNo) || [];

        // Current usage must no longer report Field 138
        expect(activeFields).not.toContain(138);

        // Original claim remains preserved in history
        const historicalClaim = await prisma.fieldClaim.findUnique({
            where: { id: claim.id }
        });
        expect(historicalClaim).not.toBeNull();
    });

    it("ADDRESS-USAGE-04: Party-contained address usage reports party and updates when party address changes", async () => {
        mockUserId = TEST_USER_ID;
        const { clientLEId, uniqueId } = await createIsolatedDossier("au04");

        const addrHome = await prisma.cCAddress.create({
            data: {
                clientLEId,
                data: {
                    addressLines: ["742 Evergreen Terrace"],
                    city: "Springfield",
                    postalCode: "SP1 1AA",
                    country: "US"
                }
            }
        });

        // Create Party with homeAddressRef pointing to addrHome
        const party = await prisma.cCParty.create({
            data: {
                clientLEId,
                data: {
                    schemaVersion: 2,
                    partyType: "INDIVIDUAL",
                    title: null,
                    forenames: "Homer",
                    surname: "Simpson",
                    emails: [],
                    phones: [],
                    roles: [],
                    sourceIdentifiers: [],
                    nationality: [],
                    placeOfBirth: null,
                    dateOfBirth: null,
                    homeAddressRef: {
                        ccAddressId: addrHome.id
                    }
                }
            }
        });

        const usageMapInitial = await getCCAddressUsage(clientLEId);
        const homeSummaryInitial = usageMapInitial[addrHome.id];
        expect(homeSummaryInitial).toBeDefined();
        const partyIds = homeSummaryInitial?.partyUsages.map(p => p.ccPartyId) || [];
        expect(partyIds).toContain(party.id);

        // Update Party to remove homeAddressRef
        await prisma.cCParty.update({
            where: { id: party.id },
            data: {
                data: {
                    schemaVersion: 2,
                    partyType: "INDIVIDUAL",
                    title: null,
                    forenames: "Homer",
                    surname: "Simpson",
                    emails: [],
                    phones: [],
                    roles: [],
                    sourceIdentifiers: [],
                    nationality: [],
                    placeOfBirth: null,
                    dateOfBirth: null,
                    homeAddressRef: null
                }
            }
        });

        const usageMapUpdated = await getCCAddressUsage(clientLEId);
        const homeSummaryUpdated = usageMapUpdated[addrHome.id];
        const updatedPartyIds = homeSummaryUpdated?.partyUsages.map(p => p.ccPartyId) || [];
        expect(updatedPartyIds).not.toContain(party.id);
    });

    it("ADDRESS-USAGE-05: Dossier isolation — usage for ClientLE A never includes address usages from ClientLE B", async () => {
        mockUserId = TEST_USER_ID;
        const dossierA = await createIsolatedDossier("au05-a");
        const dossierB = await createIsolatedDossier("au05-b");

        const addrA = await prisma.cCAddress.create({
            data: {
                clientLEId: dossierA.clientLEId,
                data: {
                    addressLines: ["Dossier A Address"],
                    city: "London",
                    postalCode: "W1A 1AA",
                    country: "GB"
                }
            }
        });

        const addrB = await prisma.cCAddress.create({
            data: {
                clientLEId: dossierB.clientLEId,
                data: {
                    addressLines: ["Dossier B Address"],
                    city: "London",
                    postalCode: "E1 6AN",
                    country: "GB"
                }
            }
        });

        // Field 138 in Dossier A references addrA
        const claimA = await FieldClaimService.assertClaim({
            fieldNo: 138,
            clientLEId: dossierA.clientLEId,
            sourceType: SourceType.USER_INPUT,
            valueJson: { ccAddressId: addrA.id }
        });
        await FieldClaimService.verifyClaim(claimA.id, TEST_USER_ID);

        // Field 138 in Dossier B references addrB
        const claimB = await FieldClaimService.assertClaim({
            fieldNo: 138,
            clientLEId: dossierB.clientLEId,
            sourceType: SourceType.USER_INPUT,
            valueJson: { ccAddressId: addrB.id }
        });
        await FieldClaimService.verifyClaim(claimB.id, TEST_USER_ID);

        const usageMapA = await getCCAddressUsage(dossierA.clientLEId);

        // Assert 1: Dossier A's address is present
        expect(usageMapA[addrA.id]).toBeDefined();

        // Assert 2 (DOSSIER ISOLATION): Dossier B's address must NOT exist in Dossier A's returned usage map
        expect(usageMapA[addrB.id]).toBeUndefined();
    });
});
