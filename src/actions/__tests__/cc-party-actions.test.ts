import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock getIdentity
vi.mock("@/lib/auth", () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: "user-123" }),
}));

// Mock next/cache
vi.mock("next/cache", () => ({
    revalidatePath: vi.fn(),
}));

const mockCCPartyFindMany = vi.fn();
const mockCCPartyCreate = vi.fn();
const mockCCPartyUpdate = vi.fn();
const mockCCPartyDelete = vi.fn();
    const mockFieldClaimFindMany = vi.fn();
    const mockMasterFieldDefinitionFindMany = vi.fn();

    vi.mock("@/lib/prisma", () => ({
        default: {
            cCParty: {
                findMany: (...args: any[]) => mockCCPartyFindMany(...args),
                create: (...args: any[]) => mockCCPartyCreate(...args),
                update: (...args: any[]) => mockCCPartyUpdate(...args),
                delete: (...args: any[]) => mockCCPartyDelete(...args),
            },
            fieldClaim: {
                findMany: (...args: any[]) => mockFieldClaimFindMany(...args),
            },
            masterFieldDefinition: {
                findMany: (...args: any[]) => mockMasterFieldDefinitionFindMany(...args),
            }
        },
    }));

const mockGetMasterFieldDefinition = vi.fn();
vi.mock("@/services/masterData/definitionService", () => ({
    getMasterFieldDefinition: (...args: any[]) => mockGetMasterFieldDefinition(...args),
}));

import { getCCParties, upsertCCParty, deleteCCParty } from "../cc-party-actions";
import { PartyValue } from "@/lib/master-data/party-value";

const validParty: PartyValue = {
    contactType: "PERSON",
    partyType: "INDIVIDUAL",
    partySubType: "PERSON",
    title: "Mr",
    forenames: "John",
    surname: "Doe",
    email: "john.doe@example.com",
    phones: [],
    nationality: ["GB"],
    countryOfResidence: "United Kingdom",
    dateOfBirth: { year: 1980, month: 5, day: 12 },
    placeOfBirth: "London",
    roles: [],
    sourceIdentifiers: [],
    isActiveParty: true,
    isActivePersonOrContact: true,
    visibility: { scope: "CLIENT_LE" }
};

describe("cc-party-actions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("getCCParties", () => {
        it("returns all curated parties for a client LE", async () => {
            const mockParties = [
                { id: "party-1", clientLEId: "le-123", data: validParty, createdAt: new Date(), createdFromClaimId: null }
            ];
            mockCCPartyFindMany.mockResolvedValue(mockParties);
            mockFieldClaimFindMany.mockResolvedValue([]);

            const result = await getCCParties("le-123");
            expect(result).toEqual([{
                ...mockParties[0],
                originType: "MANUAL",
                originLabel: "Created manually in CCC",
                usage: []
            }]);
            expect(mockCCPartyFindMany).toHaveBeenCalledWith({
                where: { clientLEId: "le-123" },
                orderBy: { createdAt: "desc" }
            });
        });

        it("returns promoted metadata for promoted parties", async () => {
            const mockParties = [
                { id: "party-2", clientLEId: "le-123", data: validParty, createdAt: new Date(), createdFromClaimId: "claim-1" }
            ];
            mockCCPartyFindMany.mockResolvedValue(mockParties);
            
            mockFieldClaimFindMany.mockResolvedValue([
                { id: "claim-1", fieldNo: 63, sourceType: "COMPANY_REGISTRY" }
            ]);

            mockGetMasterFieldDefinition.mockResolvedValue({
                fieldName: "List of company directors"
            });

            const result = await getCCParties("le-123");
            expect(result).toEqual([{
                ...mockParties[0],
                originType: "PROMOTED",
                originLabel: "Promoted from Field 63 — List of company directors",
                originFieldNo: 63,
                originFieldName: "List of company directors",
                originSourceLabel: "Companies House",
                originClaimId: "claim-1",
                usage: []
            }]);
        });
    });

    describe("upsertCCParty", () => {
        it("creates a new curated party if id is omitted", async () => {
            mockCCPartyCreate.mockResolvedValue({
                id: "new-party-id",
                clientLEId: "le-123",
                data: validParty,
                visibility: "CLIENT_LE",
                createdByUserId: "user-123",
                updatedByUserId: "user-123"
            });

            const result = await upsertCCParty({
                clientLEId: "le-123",
                data: validParty
            });

            expect(result.success).toBe(true);
            expect(result.party.id).toBe("new-party-id");
            expect(mockCCPartyCreate).toHaveBeenCalledWith({
                data: {
                    clientLEId: "le-123",
                    data: validParty,
                    visibility: "CLIENT_LE",
                    createdByUserId: "user-123",
                    updatedByUserId: "user-123"
                }
            });
        });

        it("updates existing party if id is provided", async () => {
            mockCCPartyUpdate.mockResolvedValue({
                id: "existing-id",
                clientLEId: "le-123",
                data: { ...validParty, forenames: "Johnny" }
            });

            const result = await upsertCCParty({
                id: "existing-id",
                clientLEId: "le-123",
                data: { ...validParty, forenames: "Johnny" }
            });

            expect(result.success).toBe(true);
            expect(result.party.id).toBe("existing-id");
            expect(mockCCPartyUpdate).toHaveBeenCalledWith({
                where: { id: "existing-id" },
                data: {
                    data: { ...validParty, forenames: "Johnny" } as any,
                    updatedByUserId: "user-123"
                }
            });
        });

        it("throws error for invalid PartyValue structure", async () => {
            const invalidParty = { someRandomKey: "hello" } as any;

            await expect(upsertCCParty({
                clientLEId: "le-123",
                data: invalidParty
            })).rejects.toThrow("Invalid PartyValue data structure");
        });
    });

    describe("deleteCCParty", () => {
        it("deletes party and returns success", async () => {
            mockMasterFieldDefinitionFindMany.mockResolvedValue([]);
            mockFieldClaimFindMany.mockResolvedValue([]);
            mockCCPartyDelete.mockResolvedValue({});

            const result = await deleteCCParty("party-123", "le-123");
            expect(result.success).toBe(true);
            expect(mockCCPartyDelete).toHaveBeenCalledWith({
                where: { id: "party-123" }
            });
        });
    });
});
