import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { assertUatDbTestEnv } from "@/lib/kyc/__tests__/test-env-guard";
import prisma from "@/lib/prisma";
import {
    getCCParties,
    searchCCParties,
    upsertCCParty,
    upsertCCPartyV2,
    deleteCCParty
} from "@/actions/cc-party-actions";
import {
    getCCAddresses,
    searchCCAddresses,
    upsertCCAddress,
    deleteCCAddress
} from "@/actions/cc-address-actions";
import { PartyValue } from "@/lib/master-data/party-value";
import { AddressValue } from "@/lib/master-data/address-value";

let mockUserId = "usr-onp121-test";

// Mock auth so getIdentity returns mockUserId
vi.mock("@/lib/auth", () => ({
    getIdentity: vi.fn().mockImplementation(() => Promise.resolve({
        userId: mockUserId,
        email: "uat+onp121@onpro.tech",
        role: "LE_ADMIN",
        orgId: "org-onp121-test"
    }))
}));

// Mock revalidatePath so server actions don't fail outside Next server context
vi.mock("next/cache", () => ({
    revalidatePath: vi.fn()
}));

describe("ONP-121: Shared Party/Address CRUD Actions Authorization & Scope Gate (DB Integration)", () => {
    const timestamp = Date.now();
    const TEST_USER_A_ID = `usr-onp121-a-${timestamp}`;
    const TEST_USER_B_ID = `usr-onp121-b-${timestamp}`;
    const TEST_UNAUTH_USER_ID = `usr-onp121-unauth-${timestamp}`;

    const TEST_LE_A_ID = `le-entity-onp121-a-${timestamp}`;
    const TEST_CLIENT_LE_A_ID = `le-onp121-a-${timestamp}`;

    const TEST_LE_B_ID = `le-entity-onp121-b-${timestamp}`;
    const TEST_CLIENT_LE_B_ID = `le-onp121-b-${timestamp}`;

    let partyAId: string;
    let partyBId: string;
    let addressAId: string;
    let addressBId: string;

    const samplePartyDataA: PartyValue = {
        name: "Arthur Dent Ltd",
        partyType: "ORGANISATION",
        registrationNumber: "UK-123456",
        countryOfIncorporation: "GB"
    };

    const samplePartyDataB: PartyValue = {
        name: "Ford Prefect Holdings",
        partyType: "ORGANISATION",
        registrationNumber: "UK-987654",
        countryOfIncorporation: "GB"
    };

    const sampleAddressDataA: AddressValue = {
        addressLine1: "42 Country Lane",
        city: "Cottington",
        postalCode: "CT1 1AA",
        countryCode: "GB"
    };

    const sampleAddressDataB: AddressValue = {
        addressLine1: "155 Megadodo House",
        city: "London",
        postalCode: "EC1A 1BB",
        countryCode: "GB"
    };

    beforeAll(async () => {
        assertUatDbTestEnv();

        // 1. Seed Users
        await prisma.user.create({
            data: { id: TEST_USER_A_ID, email: `onp121-a-${timestamp}@test.onpro.tech`, name: "User Dossier A" }
        });
        await prisma.user.create({
            data: { id: TEST_USER_B_ID, email: `onp121-b-${timestamp}@test.onpro.tech`, name: "User Dossier B" }
        });
        await prisma.user.create({
            data: { id: TEST_UNAUTH_USER_ID, email: `onp121-unauth-${timestamp}@test.onpro.tech`, name: "Unauthorized User" }
        });

        // 2. Seed Dossier A
        await prisma.legalEntity.create({
            data: { id: TEST_LE_A_ID, name: "Dossier A LE", reference: `REF-A-${timestamp}` }
        });
        await prisma.clientLE.create({
            data: { id: TEST_CLIENT_LE_A_ID, name: "Dossier A ClientLE", legalEntityId: TEST_LE_A_ID }
        });
        await prisma.membership.create({
            data: { userId: TEST_USER_A_ID, clientLEId: TEST_CLIENT_LE_A_ID, role: "LE_ADMIN" }
        });

        // 3. Seed Dossier B
        await prisma.legalEntity.create({
            data: { id: TEST_LE_B_ID, name: "Dossier B LE", reference: `REF-B-${timestamp}` }
        });
        await prisma.clientLE.create({
            data: { id: TEST_CLIENT_LE_B_ID, name: "Dossier B ClientLE", legalEntityId: TEST_LE_B_ID }
        });
        await prisma.membership.create({
            data: { userId: TEST_USER_B_ID, clientLEId: TEST_CLIENT_LE_B_ID, role: "LE_ADMIN" }
        });

        // 4. Seed initial Parties and Addresses in A & B
        const pA = await prisma.cCParty.create({
            data: {
                clientLEId: TEST_CLIENT_LE_A_ID,
                data: samplePartyDataA as any,
                createdByUserId: TEST_USER_A_ID
            }
        });
        partyAId = pA.id;

        const pB = await prisma.cCParty.create({
            data: {
                clientLEId: TEST_CLIENT_LE_B_ID,
                data: samplePartyDataB as any,
                createdByUserId: TEST_USER_B_ID
            }
        });
        partyBId = pB.id;

        const adA = await prisma.cCAddress.create({
            data: {
                clientLEId: TEST_CLIENT_LE_A_ID,
                data: sampleAddressDataA as any,
                visibility: "CLIENT_LE",
                createdByUserId: TEST_USER_A_ID,
                updatedByUserId: TEST_USER_A_ID
            }
        });
        addressAId = adA.id;

        const adB = await prisma.cCAddress.create({
            data: {
                clientLEId: TEST_CLIENT_LE_B_ID,
                data: sampleAddressDataB as any,
                visibility: "CLIENT_LE",
                createdByUserId: TEST_USER_B_ID,
                updatedByUserId: TEST_USER_B_ID
            }
        });
        addressBId = adB.id;
    });

    afterAll(async () => {
        try {
            await prisma.cCAddress.deleteMany({
                where: { clientLEId: { in: [TEST_CLIENT_LE_A_ID, TEST_CLIENT_LE_B_ID] } }
            });
            await prisma.cCParty.deleteMany({
                where: { clientLEId: { in: [TEST_CLIENT_LE_A_ID, TEST_CLIENT_LE_B_ID] } }
            });
            await prisma.membership.deleteMany({
                where: { clientLEId: { in: [TEST_CLIENT_LE_A_ID, TEST_CLIENT_LE_B_ID] } }
            });
            await prisma.clientLE.deleteMany({
                where: { id: { in: [TEST_CLIENT_LE_A_ID, TEST_CLIENT_LE_B_ID] } }
            });
            await prisma.legalEntity.deleteMany({
                where: { id: { in: [TEST_LE_A_ID, TEST_LE_B_ID] } }
            });
            await prisma.user.deleteMany({
                where: { id: { in: [TEST_USER_A_ID, TEST_USER_B_ID, TEST_UNAUTH_USER_ID] } }
            });
        } catch (cleanupErr) {
            console.error("Cleanup error in onp-121-shared-crud-auth:", cleanupErr);
        }
    });

    // ─────────────────────────────────────────────────────────────
    // CRUD-AUTH-01 — Authorised Read
    // ─────────────────────────────────────────────────────────────
    it("CRUD-AUTH-01: User with ClientLE view permission can list and search saved Parties and Addresses", async () => {
        mockUserId = TEST_USER_A_ID;

        const parties = await getCCParties(TEST_CLIENT_LE_A_ID);
        expect(Array.isArray(parties)).toBe(true);
        expect(parties.some(p => p.id === partyAId)).toBe(true);

        const searchedParties = await searchCCParties(TEST_CLIENT_LE_A_ID, "Arthur");
        expect(searchedParties.length).toBeGreaterThan(0);
        expect(searchedParties.some(p => p.id === partyAId)).toBe(true);

        const addresses = await getCCAddresses(TEST_CLIENT_LE_A_ID);
        expect(Array.isArray(addresses)).toBe(true);
        expect(addresses.some(a => a.id === addressAId)).toBe(true);

        const searchedAddresses = await searchCCAddresses(TEST_CLIENT_LE_A_ID, "Cottington");
        expect(searchedAddresses.length).toBeGreaterThan(0);
        expect(searchedAddresses.some(a => a.id === addressAId)).toBe(true);
    });

    // ─────────────────────────────────────────────────────────────
    // CRUD-AUTH-02 — Unauthorised Read
    // ─────────────────────────────────────────────────────────────
    it("CRUD-AUTH-02: Authenticated user with no access to ClientLE B cannot obtain Party or Address data by supplying ClientLE B ID", async () => {
        mockUserId = TEST_USER_A_ID; // User A has NO membership in ClientLE B

        // getCCParties on ClientLE B
        await expect(getCCParties(TEST_CLIENT_LE_B_ID)).rejects.toThrow(/Unauthorized/i);

        // searchCCParties on ClientLE B
        await expect(searchCCParties(TEST_CLIENT_LE_B_ID, "Ford")).rejects.toThrow(/Unauthorized/i);

        // getCCAddresses on ClientLE B
        await expect(getCCAddresses(TEST_CLIENT_LE_B_ID)).rejects.toThrow(/Unauthorized/i);

        // searchCCAddresses on ClientLE B
        await expect(searchCCAddresses(TEST_CLIENT_LE_B_ID, "London")).rejects.toThrow(/Unauthorized/i);
    });

    // ─────────────────────────────────────────────────────────────
    // CRUD-AUTH-03 — Authorised Create / Update
    // ─────────────────────────────────────────────────────────────
    it("CRUD-AUTH-03: User with edit permission may create/update a saved Party and saved Address in their authorised dossier", async () => {
        mockUserId = TEST_USER_A_ID;

        // 1. Create Party in ClientLE A
        const partyRes = await upsertCCParty({
            clientLEId: TEST_CLIENT_LE_A_ID,
            data: {
                name: "Trillian Astro Corp",
                partyType: "ORGANISATION",
                countryOfIncorporation: "GB"
            }
        });
        expect(partyRes.success).toBe(true);
        expect(partyRes.party).toBeDefined();

        // 2. Update existing Party A
        const partyUpdateRes = await upsertCCParty({
            id: partyAId,
            clientLEId: TEST_CLIENT_LE_A_ID,
            data: {
                ...samplePartyDataA,
                name: "Arthur Dent Ltd Updated"
            }
        });
        expect(partyUpdateRes.success).toBe(true);

        // 3. Create Address in ClientLE A
        const addressRes = await upsertCCAddress({
            clientLEId: TEST_CLIENT_LE_A_ID,
            data: {
                addressLine1: "99 New Earth Road",
                city: "Cottington",
                postalCode: "CT2 2BB",
                countryCode: "GB"
            }
        });
        expect(addressRes.success).toBe(true);
        expect(addressRes.ccAddress).toBeDefined();

        // 4. Update existing Address A
        const addressUpdateRes = await upsertCCAddress({
            id: addressAId,
            clientLEId: TEST_CLIENT_LE_A_ID,
            data: {
                ...sampleAddressDataA,
                addressLine1: "42 Country Lane Renovated"
            }
        });
        expect(addressUpdateRes.success).toBe(true);
    });

    // ─────────────────────────────────────────────────────────────
    // CRUD-AUTH-04 — Unauthorised Create
    // ─────────────────────────────────────────────────────────────
    it("CRUD-AUTH-04: Authenticated user cannot create a Party/Address under another ClientLE by supplying its ID", async () => {
        mockUserId = TEST_USER_A_ID; // User A attempting to create in ClientLE B

        // Party create in ClientLE B
        const partyAttempt = async () => {
            const res = await upsertCCParty({
                clientLEId: TEST_CLIENT_LE_B_ID,
                data: {
                    name: "Malicious Party",
                    partyType: "ORGANISATION",
                    countryOfIncorporation: "GB"
                }
            });
            if (res && res.success === false) throw new Error(res.error || "Unauthorized");
            return res;
        };
        await expect(partyAttempt()).rejects.toThrow(/Unauthorized/i);

        // Address create in ClientLE B
        const addressAttempt = async () => {
            const res = await upsertCCAddress({
                clientLEId: TEST_CLIENT_LE_B_ID,
                data: {
                    addressLine1: "Malicious Address",
                    city: "Nowhere",
                    countryCode: "GB"
                }
            });
            if (res && res.success === false) throw new Error(res.error || "Unauthorized");
            return res;
        };
        await expect(addressAttempt()).rejects.toThrow(/Unauthorized/i);
    });

    // ─────────────────────────────────────────────────────────────
    // CRUD-AUTH-05 — Unauthorised Party Update
    // ─────────────────────────────────────────────────────────────
    it("CRUD-AUTH-05: User authorised only for ClientLE A cannot update Party B", async () => {
        mockUserId = TEST_USER_A_ID; // User A attempting to update Party B under ClientLE B

        const updateAttempt = async () => {
            const res = await upsertCCParty({
                id: partyBId,
                clientLEId: TEST_CLIENT_LE_B_ID,
                data: {
                    ...samplePartyDataB,
                    name: "Hijacked Party B"
                }
            });
            if (res && res.success === false) throw new Error(res.error || "Unauthorized");
            return res;
        };
        await expect(updateAttempt()).rejects.toThrow(/Unauthorized/i);

        // Verify Party B in DB was NOT mutated
        const freshPartyB = await prisma.cCParty.findUnique({ where: { id: partyBId } });
        expect((freshPartyB?.data as any)?.name || (freshPartyB?.data as any)?.legalName).not.toBe("Hijacked Party B");
    });

    // ─────────────────────────────────────────────────────────────
    // CRUD-AUTH-06 — Unauthorised Address Update
    // ─────────────────────────────────────────────────────────────
    it("CRUD-AUTH-06: User authorised only for ClientLE A cannot update Address B by resource ID", async () => {
        mockUserId = TEST_USER_A_ID; // User A attempting to update Address B under ClientLE B

        const updateAttempt = async () => {
            const res = await upsertCCAddress({
                id: addressBId,
                clientLEId: TEST_CLIENT_LE_B_ID,
                data: {
                    ...sampleAddressDataB,
                    addressLine1: "Hijacked Address B"
                }
            });
            if (res && res.success === false) throw new Error(res.error || "Unauthorized");
            return res;
        };
        await expect(updateAttempt()).rejects.toThrow(/Unauthorized/i);

        // Verify Address B in DB was NOT mutated
        const freshAddressB = await prisma.cCAddress.findUnique({ where: { id: addressBId } });
        expect((freshAddressB?.data as any)?.addressLine1).not.toBe("Hijacked Address B");
    });

    // ─────────────────────────────────────────────────────────────
    // CRUD-AUTH-07 — Unauthorised Delete
    // ─────────────────────────────────────────────────────────────
    it("CRUD-AUTH-07: Unauthorised user cannot delete Party/Address records from another dossier", async () => {
        mockUserId = TEST_USER_A_ID; // User A attempting to delete Party B and Address B

        // Delete Party B
        const deletePartyAttempt = async () => {
            const res = await deleteCCParty(partyBId, TEST_CLIENT_LE_B_ID);
            if (res && res.success === false) throw new Error(res.error || "Unauthorized");
            return res;
        };
        await expect(deletePartyAttempt()).rejects.toThrow(/Unauthorized/i);

        // Delete Address B
        const deleteAddressAttempt = async () => {
            const res = await deleteCCAddress(addressBId, TEST_CLIENT_LE_B_ID);
            if (res && res.success === false) throw new Error(res.error || "Unauthorized");
            return res;
        };
        await expect(deleteAddressAttempt()).rejects.toThrow(/Unauthorized/i);

        // Verify Party B and Address B still exist in DB
        expect(await prisma.cCParty.findUnique({ where: { id: partyBId } })).not.toBeNull();
        expect(await prisma.cCAddress.findUnique({ where: { id: addressBId } })).not.toBeNull();
    });

    // ─────────────────────────────────────────────────────────────
    // CRUD-AUTH-08 — Resource / ClientLE Mismatch
    // ─────────────────────────────────────────────────────────────
    it("CRUD-AUTH-08: Authorised user for ClientLE A cannot pass foreign resource from ClientLE B with clientLEId=ClientLE A to mutate/delete it", async () => {
        mockUserId = TEST_USER_A_ID; // User A is authorised for ClientLE A, but passes foreign resource ID from ClientLE B

        // 1. Attempt to mutate Party B by claiming it belongs to ClientLE A
        const mismatchPartyUpdate = async () => {
            const res = await upsertCCParty({
                id: partyBId,
                clientLEId: TEST_CLIENT_LE_A_ID,
                data: {
                    ...samplePartyDataB,
                    name: "Cross-Dossier Injection Party"
                }
            });
            if (res && res.success === false) throw new Error(res.error || "Mismatched resource");
            return res;
        };
        await expect(mismatchPartyUpdate()).rejects.toThrow();

        // 2. Attempt to mutate Address B by claiming it belongs to ClientLE A
        const mismatchAddressUpdate = async () => {
            const res = await upsertCCAddress({
                id: addressBId,
                clientLEId: TEST_CLIENT_LE_A_ID,
                data: {
                    ...sampleAddressDataB,
                    addressLine1: "Cross-Dossier Injection Address"
                }
            });
            if (res && res.success === false) throw new Error(res.error || "Mismatched resource");
            return res;
        };
        await expect(mismatchAddressUpdate()).rejects.toThrow();

        // 3. Attempt to delete Party B by passing clientLEId = ClientLE A
        const mismatchPartyDelete = async () => {
            const res = await deleteCCParty(partyBId, TEST_CLIENT_LE_A_ID);
            if (res && res.success === false) throw new Error(res.error || "Mismatched resource");
            return res;
        };
        await expect(mismatchPartyDelete()).rejects.toThrow();

        // 4. Attempt to delete Address B by passing clientLEId = ClientLE A
        const mismatchAddressDelete = async () => {
            const res = await deleteCCAddress(addressBId, TEST_CLIENT_LE_A_ID);
            if (res && res.success === false) throw new Error(res.error || "Mismatched resource");
            return res;
        };
        await expect(mismatchAddressDelete()).rejects.toThrow();

        // Verify foreign records were neither altered nor deleted
        const freshPartyB = await prisma.cCParty.findUnique({ where: { id: partyBId } });
        expect(freshPartyB).not.toBeNull();
        expect((freshPartyB?.data as any)?.name || (freshPartyB?.data as any)?.legalName).not.toBe("Cross-Dossier Injection Party");

        const freshAddressB = await prisma.cCAddress.findUnique({ where: { id: addressBId } });
        expect(freshAddressB).not.toBeNull();
        expect((freshAddressB?.data as any)?.addressLine1).not.toBe("Cross-Dossier Injection Address");
    });
});
