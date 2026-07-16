import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prismaMock } from '@/lib/__mocks__/prisma';
import { resolveCCAddressUsages } from "../cc-address-usage-resolver";
import { v4 as uuidv4 } from "uuid";

vi.mock('@/lib/prisma');
vi.mock('@/services/masterData/definitionService', () => ({
    getMasterFieldDefinition: vi.fn().mockResolvedValue({ fieldName: 'Mock Field' })
}));

describe('resolveCCAddressUsages', () => {
    const clientLEId = uuidv4();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns empty summary when no parties or fields exist', async () => {
        const addressId = uuidv4();
        // @ts-ignore
        prismaMock.cCAddress.findMany.mockResolvedValue([{ id: addressId, clientLEId }]);
        // @ts-ignore
        prismaMock.fieldClaim.findMany.mockResolvedValue([]);
        // @ts-ignore
        prismaMock.cCParty.findMany.mockResolvedValue([]);

        const summary = await resolveCCAddressUsages(clientLEId, [addressId]);
        expect(summary[addressId].partyUsages).toEqual([]);
        expect(summary[addressId].fieldUsages).toEqual([]);
    });

    it('extracts INDIVIDUAL homeAddressRef correctly', async () => {
        const addressId = uuidv4();
        // @ts-ignore
        prismaMock.cCAddress.findMany.mockResolvedValue([{ id: addressId, clientLEId }]);
        // @ts-ignore
        prismaMock.fieldClaim.findMany.mockResolvedValue([]);

        const partyId = uuidv4();
        // @ts-ignore
        prismaMock.cCParty.findMany.mockResolvedValue([
            {
                id: partyId,
                clientLEId,
                visibility: "CLIENT_LE",
                data: {
                    schemaVersion: 2,
                    partyType: "INDIVIDUAL",
                    emails: [], phones: [], roles: [], sourceIdentifiers: [],
                    forenames: "Test",
                    surname: "Person",
                    homeAddressRef: { ccAddressId: addressId },
                    nationality: [],
                    placeOfBirth: null,
                    dateOfBirth: null
                }
            }
        ]);

        const summary = await resolveCCAddressUsages(clientLEId, [addressId]);
        expect(summary[addressId].partyUsages).toHaveLength(1);
        expect(summary[addressId].partyUsages[0].ccPartyId).toBe(partyId);
        expect(summary[addressId].partyUsages[0].usageKind).toBe("HOME_ADDRESS");
        expect(summary[addressId].partyUsages[0].partyLabel).toBe("Test Person");
    });

    it('extracts ORGANISATION registeredAddressRef correctly', async () => {
        const addressId = uuidv4();
        // @ts-ignore
        prismaMock.cCAddress.findMany.mockResolvedValue([{ id: addressId, clientLEId }]);
        // @ts-ignore
        prismaMock.fieldClaim.findMany.mockResolvedValue([]);

        const partyId = uuidv4();
        // @ts-ignore
        prismaMock.cCParty.findMany.mockResolvedValue([
            {
                id: partyId,
                clientLEId,
                visibility: "CLIENT_LE",
                data: {
                    schemaVersion: 2,
                    partyType: "ORGANISATION",
                    emails: [], phones: [], roles: [], sourceIdentifiers: [],
                    legalName: "Test Org",
                    registeredAddressRef: { ccAddressId: addressId }
                }
            }
        ]);

        const summary = await resolveCCAddressUsages(clientLEId, [addressId]);
        expect(summary[addressId].partyUsages).toHaveLength(1);
        expect(summary[addressId].partyUsages[0].ccPartyId).toBe(partyId);
        expect(summary[addressId].partyUsages[0].usageKind).toBe("REGISTERED_ADDRESS");
    });

    it('extracts TEAM correspondenceAddressRef correctly', async () => {
        const addressId = uuidv4();
        // @ts-ignore
        prismaMock.cCAddress.findMany.mockResolvedValue([{ id: addressId, clientLEId }]);
        // @ts-ignore
        prismaMock.fieldClaim.findMany.mockResolvedValue([]);

        const partyId = uuidv4();
        // @ts-ignore
        prismaMock.cCParty.findMany.mockResolvedValue([
            {
                id: partyId,
                clientLEId,
                visibility: "CLIENT_LE",
                data: {
                    schemaVersion: 2,
                    partyType: "TEAM",
                    emails: [], phones: [], roles: [], sourceIdentifiers: [],
                    teamName: "Test Team",
                    correspondenceAddressRef: { ccAddressId: addressId },
                    location: null
                }
            }
        ]);

        const summary = await resolveCCAddressUsages(clientLEId, [addressId]);
        expect(summary[addressId].partyUsages).toHaveLength(1);
        expect(summary[addressId].partyUsages[0].ccPartyId).toBe(partyId);
        expect(summary[addressId].partyUsages[0].usageKind).toBe("CORRESPONDENCE_ADDRESS");
    });

    it('extracts ROLE_CORRESPONDENCE_ADDRESS from party roles', async () => {
        const addressId = uuidv4();
        // @ts-ignore
        prismaMock.cCAddress.findMany.mockResolvedValue([{ id: addressId, clientLEId }]);
        // @ts-ignore
        prismaMock.fieldClaim.findMany.mockResolvedValue([]);

        const partyId = uuidv4();
        // @ts-ignore
        prismaMock.cCParty.findMany.mockResolvedValue([
            {
                id: partyId,
                clientLEId,
                visibility: "CLIENT_LE",
                data: {
                    schemaVersion: 2,
                    partyType: "INDIVIDUAL",
                    emails: [], phones: [], sourceIdentifiers: [],
                    forenames: "Test",
                    surname: "Person",
                    homeAddressRef: null,
                    nationality: [],
                    placeOfBirth: null,
                    dateOfBirth: null,
                    roles: [
                        {
                            roleTitle: "Director",
                            correspondenceAddressRef: { ccAddressId: addressId },
                            company: { name: "Test Corp", externalId: "role-123" }
                        }
                    ]
                }
            }
        ]);

        const summary = await resolveCCAddressUsages(clientLEId, [addressId]);
        expect(summary[addressId].partyUsages).toHaveLength(1);
        expect(summary[addressId].partyUsages[0].ccPartyId).toBe(partyId);
        expect(summary[addressId].partyUsages[0].usageKind).toBe("ROLE_CORRESPONDENCE_ADDRESS");
        expect(summary[addressId].partyUsages[0].roleId).toBe("role-123");
        expect(summary[addressId].partyUsages[0].roleTitle).toBe("Director");
        expect(summary[addressId].partyUsages[0].roleCompanyName).toBe("Test Corp");
    });

    it('filters out malformed parties gracefully', async () => {
        const addressId = uuidv4();
        // @ts-ignore
        prismaMock.cCAddress.findMany.mockResolvedValue([{ id: addressId, clientLEId }]);
        // @ts-ignore
        prismaMock.fieldClaim.findMany.mockResolvedValue([]);

        const partyId = uuidv4();
        // @ts-ignore
        prismaMock.cCParty.findMany.mockResolvedValue([
            {
                id: partyId,
                clientLEId,
                visibility: "CLIENT_LE",
                data: {
                    partyType: "INVALID_TYPE", // Should fail normalisation
                    individual: {
                        firstName: "Test",
                        lastName: "Person",
                        homeAddressRef: { ccAddressId: addressId }
                    }
                }
            }
        ]);

        const summary = await resolveCCAddressUsages(clientLEId, [addressId]);
        expect(summary[addressId].partyUsages).toHaveLength(0); // Ignored safely
    });
});
