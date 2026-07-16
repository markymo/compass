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
const mockFieldClaimFindUnique = vi.fn();
const mockMasterFieldDefinitionFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
    default: {
        cCParty: {
            findMany: (...args: any[]) => mockCCPartyFindMany(...args),
            create: (...args: any[]) => mockCCPartyCreate(...args),
            update: (...args: any[]) => mockCCPartyUpdate(...args),
            delete: (...args: any[]) => mockCCPartyDelete(...args),
            findFirst: vi.fn().mockResolvedValue(null)
        },
        fieldClaim: {
            findMany: (...args: any[]) => mockFieldClaimFindMany(...args),
            findUnique: (...args: any[]) => mockFieldClaimFindUnique(...args)
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

const { mockCCPartyServiceCreate, mockCCPartyServiceUpdate } = vi.hoisted(() => ({
    mockCCPartyServiceCreate: vi.fn(),
    mockCCPartyServiceUpdate: vi.fn()
}));

vi.mock("@/services/masterData/cc-party-service", () => ({
    CCPartyService: {
        create: mockCCPartyServiceCreate,
        update: mockCCPartyServiceUpdate
    }
}));

import { getCCParties, upsertCCParty, deleteCCParty, promoteClaimToCCParty } from "../cc-party-actions";
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
    });

    describe("upsertCCParty", () => {
        it("converts payload, omits embedded addresses, calls CCPartyService, and bypasses Prisma CCParty directly", async () => {
            const legacyPayloadWithEmbeddedAddresses: any = {
                ...validParty,
                // Top-level embedded address to be omitted
                embeddedHomeAddress: {
                    buildingName: '123',
                    street: 'Main St',
                    country: 'UK'
                },
                roles: [{
                    roleType: 'director',
                    isActiveRole: true,
                    // Role-level embedded address to be omitted
                    correspondenceAddress: {
                        buildingName: '456',
                        street: 'Second St',
                        country: 'UK'
                    }
                }]
            };

            mockCCPartyServiceCreate.mockResolvedValue({
                id: "new-party-id",
                clientLEId: "le-123",
                data: { schemaVersion: 2 },
                visibility: "CLIENT_LE"
            });

            const result = await upsertCCParty({
                clientLEId: "le-123",
                data: legacyPayloadWithEmbeddedAddresses
            });

            expect(result.success).toBe(true);
            
            // Prove CCPartyService was called with correctly converted schema (no embedded addresses)
            expect(mockCCPartyServiceCreate).toHaveBeenCalledWith({
                clientLEId: "le-123",
                createdByUserId: "user-123",
                data: expect.objectContaining({
                    schemaVersion: 2,
                    partyType: 'INDIVIDUAL',
                    forenames: 'John',
                    surname: 'Doe',
                    roles: expect.arrayContaining([
                        expect.objectContaining({
                            roleType: 'director',
                            isActiveRole: true
                        })
                    ])
                })
            });

            // Prove the converted payload has NO embedded addresses
            const callArgs = mockCCPartyServiceCreate.mock.calls[0][0];
            expect(callArgs.data).not.toHaveProperty('embeddedHomeAddress');
            expect(callArgs.data.roles[0]).not.toHaveProperty('correspondenceAddress');

            // Prove direct Prisma create was NEVER called
            expect(mockCCPartyCreate).not.toHaveBeenCalled();
            expect(mockCCPartyUpdate).not.toHaveBeenCalled();
        });

        it("updates existing party by delegating to CCPartyService", async () => {
            mockCCPartyServiceUpdate.mockResolvedValue({
                id: "existing-id",
                clientLEId: "le-123",
                data: { schemaVersion: 2 }
            });

            const result = await upsertCCParty({
                id: "existing-id",
                clientLEId: "le-123",
                data: validParty
            });

            expect(result.success).toBe(true);
            expect(mockCCPartyServiceUpdate).toHaveBeenCalledWith({
                ccPartyId: "existing-id",
                clientLEId: "le-123",
                data: expect.objectContaining({ schemaVersion: 2 }),
                updatedByUserId: "user-123"
            });
            expect(mockCCPartyUpdate).not.toHaveBeenCalled(); // No direct prisma
        });
    });

    describe("upsertCCPartyV2", () => {
        const { upsertCCPartyV2 } = require("../cc-party-actions");

        it("validates strict CCPartyData and delegates to CCPartyService", async () => {
            const v2Payload = {
                schemaVersion: 2,
                partyType: "INDIVIDUAL",
                forenames: "Alice",
                surname: "Smith",
                emails: [],
                phones: [],
                roles: [],
                sourceIdentifiers: [],
                isActiveParty: true
            };

            mockCCPartyServiceCreate.mockResolvedValue({
                id: "v2-party-id",
                clientLEId: "le-123",
                data: v2Payload
            });

            const result = await upsertCCPartyV2({
                clientLEId: "le-123",
                data: v2Payload
            });

            expect(result.success).toBe(true);
            expect(mockCCPartyServiceCreate).toHaveBeenCalledWith({
                clientLEId: "le-123",
                createdByUserId: "user-123",
                data: v2Payload
            });
        });

        it("rejects invalid or legacy payloads", async () => {
            const legacyPayload = {
                contactType: "PERSON",
                forenames: "Alice"
            };

            await expect(upsertCCPartyV2({
                clientLEId: "le-123",
                data: legacyPayload
            })).rejects.toThrow("Invalid CCPartyData V2 structure");
        });
    });

    describe("promoteClaimToCCParty", () => {
        it("is the sole explicitly deferred legacy writer", async () => {
            mockFieldClaimFindUnique.mockResolvedValue({
                id: 'claim-1',
                claimRole: 'VALUE',
                clientLeScopeId: 'le-123',
                fieldNo: 63,
                valueJson: validParty // Note: this is a legacy PartyValue
            });

            mockGetMasterFieldDefinition.mockResolvedValue({ appDataType: 'PARTY' });
            
            mockCCPartyCreate.mockResolvedValue({
                id: "new-party-from-claim",
                clientLEId: "le-123",
                data: validParty
            });

            const result = await promoteClaimToCCParty('claim-1', 'le-123');

            expect(result.success).toBe(true);
            
            // Prove that it writes DIRECTLY to Prisma (legacy persistence path)
            expect(mockCCPartyCreate).toHaveBeenCalledWith({
                data: {
                    clientLEId: 'le-123',
                    data: validParty, // It passes the raw legacy value!
                    visibility: "CLIENT_LE",
                    createdFromClaimId: 'claim-1',
                    createdByUserId: 'user-123',
                    updatedByUserId: 'user-123'
                }
            });

            // Prove it does NOT call the v2 service
            expect(mockCCPartyServiceCreate).not.toHaveBeenCalled();
        });
    });
});
