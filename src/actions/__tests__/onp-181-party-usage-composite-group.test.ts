import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prismaMock } from '@/lib/__mocks__/prisma';
import { getCCPartyUsage, getCCParties } from '../cc-party-actions';
import { resolveCCAddressUsages } from '../cc-address-usage-resolver';
import { ClaimStatus } from '@prisma/client';

// Mock authentication and permissions
vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: 'user-enviromena' }),
}));

vi.mock('@/lib/auth/api-auth', () => ({
    ensureApiAuthorization: vi.fn().mockResolvedValue({ userId: 'user-enviromena' }),
}));

// Mock definitionService
const mockGetMasterFieldDefinition = vi.fn();
const mockGetMasterFieldGroup = vi.fn();
vi.mock('@/services/masterData/definitionService', () => ({
    getMasterFieldDefinition: (...args: any[]) => mockGetMasterFieldDefinition(...args),
    getMasterFieldGroup: (...args: any[]) => mockGetMasterFieldGroup(...args),
}));

// Mock prisma
vi.mock('@/lib/prisma');

describe('ONP-181: Sources / Parties usage resolution for composite group / Field 274', () => {
    const clientLEId = 'le-enviromena-short-term';
    const ownerScopeId = 'scope-enviromena-org';
    const otherClientLEId = 'le-unrelated-entity';
    const otherOwnerScopeId = 'scope-other-org';

    const targetPartyId = 'party-target-psc-274';
    const unrelatedPartyId = 'party-unrelated';
    const otherLEPartyId = 'party-other-le';

    const targetAddressId = 'addr-target-274';

    beforeEach(() => {
        vi.clearAllMocks();

        // 1. ClientLE lookup
        // @ts-ignore
        prismaMock.clientLE.findUnique.mockImplementation(async ({ where }: any) => {
            if (where.id === clientLEId) {
                return {
                    id: clientLEId,
                    name: 'Test Entity Short Term',
                    legalEntityId: 'legal-entity-short-term',
                    registryReferences: [],
                };
            }
            if (where.id === otherClientLEId) {
                return {
                    id: otherClientLEId,
                    name: 'Other Entity',
                    legalEntityId: 'legal-entity-other',
                    registryReferences: [],
                };
            }
            return null;
        });

        // 2. ClientLEOwner lookup (used by KycStateService.resolveScopeId)
        // @ts-ignore
        prismaMock.clientLEOwner.findFirst.mockImplementation(async ({ where }: any) => {
            if (where.clientLEId === clientLEId && where.endAt === null) {
                return {
                    id: 'owner-rel-1',
                    clientLEId,
                    partyId: ownerScopeId,
                    endAt: null,
                };
            }
            if (where.clientLEId === otherClientLEId && where.endAt === null) {
                return {
                    id: 'owner-rel-2',
                    clientLEId: otherClientLEId,
                    partyId: otherOwnerScopeId,
                    endAt: null,
                };
            }
            return null;
        });

        // 3. SourceFieldMapping lookup (used by KycStateService.preloadMappingPriorities)
        // @ts-ignore
        prismaMock.sourceFieldMapping.findMany.mockResolvedValue([]);

        // 4. Master field definitions
        mockGetMasterFieldDefinition.mockImplementation(async (fieldNo: number) => {
            if (fieldNo === 274) {
                return {
                    fieldNo: 274,
                    fieldName: 'Persons of significant control (other)',
                    appDataType: 'PARTY',
                    isMultiValue: true,
                };
            }
            return {
                fieldNo,
                fieldName: `Field ${fieldNo}`,
                appDataType: 'TEXT',
                isMultiValue: false,
            };
        });
    });

    it('getCCPartyUsage resolves owner-scoped claims in Field 274 and attributes usage correctly', async () => {
        // Candidate claims for clientLEId: Field 274
        // @ts-ignore
        prismaMock.fieldClaim.findMany.mockImplementation(async (args: any) => {
            const { where } = args;

            // Distinct fieldNo query
            if (where.clientLEId === clientLEId && args.distinct?.includes('fieldNo')) {
                return [{ fieldNo: 274 }];
            }

            // KycStateService.getAuthoritativeCollection query for Field 274
            if (where.fieldNo === 274 && where.clientLEId === clientLEId) {
                return [
                    {
                        id: 'claim-f274-scoped-1',
                        clientLEId,
                        fieldNo: 274,
                        claimRole: 'VALUE',
                        ownerScopeId, // Enviromena scope!
                        status: ClaimStatus.ASSERTED,
                        sourceType: 'USER_INPUT',
                        sourceReference: null,
                        collectionId: null,
                        instanceId: 'inst-1',
                        valueJson: {
                            ccPartyId: targetPartyId,
                            party: {
                                partyType: 'INDIVIDUAL',
                                forenames: 'Jane',
                                surname: 'Doe',
                            },
                        },
                        valueText: null,
                        valueNumber: null,
                        valueDate: null,
                        valueAddress: null,
                        valuePerson: null,
                        valueLe: null,
                        valueOrg: null,
                        attachmentDocumentId: null,
                        evidence: null,
                        assertedAt: new Date('2026-09-01T10:00:00Z'),
                    },
                ];
            }

            return [];
        });

        // Call the usage resolver
        const usage = await getCCPartyUsage(clientLEId);

        // Target party used in Field 274 MUST be reported
        expect(usage[targetPartyId]).toBeDefined();
        expect(usage[targetPartyId]).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    fieldNo: 274,
                    fieldName: 'Persons of significant control (other)',
                }),
            ])
        );

        // Negative isolation 1: Unrelated party has no usage
        expect(usage[unrelatedPartyId]).toBeUndefined();

        // Negative isolation 2: Other ClientLE party has no usage
        expect(usage[otherLEPartyId]).toBeUndefined();
    });

    it('getCCParties attaches usage to curated parties on an owner-scoped ClientLE', async () => {
        // @ts-ignore
        prismaMock.cCParty.findMany.mockResolvedValue([
            {
                id: targetPartyId,
                clientLEId,
                data: {
                    partyType: 'INDIVIDUAL',
                    forenames: 'Jane',
                    surname: 'Doe',
                },
                createdFromClaimId: null,
            },
            {
                id: unrelatedPartyId,
                clientLEId,
                data: {
                    partyType: 'INDIVIDUAL',
                    forenames: 'Bob',
                    surname: 'Smith',
                },
                createdFromClaimId: null,
            },
        ]);

        // @ts-ignore
        prismaMock.fieldClaim.findMany.mockImplementation(async (args: any) => {
            const { where } = args;
            if (where.clientLEId === clientLEId && args.distinct?.includes('fieldNo')) {
                return [{ fieldNo: 274 }];
            }
            if (where.fieldNo === 274 && where.clientLEId === clientLEId) {
                return [
                    {
                        id: 'claim-f274-scoped-1',
                        clientLEId,
                        fieldNo: 274,
                        claimRole: 'VALUE',
                        ownerScopeId,
                        status: ClaimStatus.ASSERTED,
                        sourceType: 'USER_INPUT',
                        sourceReference: null,
                        collectionId: null,
                        instanceId: 'inst-1',
                        valueJson: {
                            ccPartyId: targetPartyId,
                        },
                        valueText: null,
                        valueNumber: null,
                        valueDate: null,
                        valueAddress: null,
                        valuePerson: null,
                        valueLe: null,
                        valueOrg: null,
                        attachmentDocumentId: null,
                        evidence: null,
                        assertedAt: new Date('2026-09-01T10:00:00Z'),
                    },
                ];
            }
            return [];
        });

        const parties = await getCCParties(clientLEId);
        const targetParty = parties.find((p: any) => p.id === targetPartyId);
        const unrelatedParty = parties.find((p: any) => p.id === unrelatedPartyId);

        expect(targetParty).toBeDefined();
        expect(targetParty?.usage).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    fieldNo: 274,
                    fieldName: 'Persons of significant control (other)',
                }),
            ])
        );

        // Negative isolation: unrelated party has empty usage array
        expect(unrelatedParty).toBeDefined();
        expect(unrelatedParty?.usage).toEqual([]);
    });

    it('resolveCCAddressUsages resolves owner-scoped claims and attributes address fieldUsages', async () => {
        // @ts-ignore
        prismaMock.cCAddress.findMany.mockResolvedValue([
            { id: targetAddressId, clientLEId },
        ]);
        // @ts-ignore
        prismaMock.cCParty.findMany.mockResolvedValue([]);

        // Field claim referencing targetAddressId in Field 274 (or another field)
        // @ts-ignore
        prismaMock.fieldClaim.findMany.mockImplementation(async (args: any) => {
            const { where } = args;
            if (where.clientLEId === clientLEId && args.distinct?.includes('fieldNo')) {
                return [{ fieldNo: 274 }];
            }
            if (where.fieldNo === 274 && where.clientLEId === clientLEId) {
                return [
                    {
                        id: 'claim-f274-scoped-addr-1',
                        clientLEId,
                        fieldNo: 274,
                        claimRole: 'VALUE',
                        ownerScopeId,
                        status: ClaimStatus.ASSERTED,
                        sourceType: 'USER_INPUT',
                        sourceReference: null,
                        collectionId: null,
                        instanceId: 'inst-1',
                        valueJson: {
                            ccAddressId: targetAddressId,
                        },
                        valueText: null,
                        valueNumber: null,
                        valueDate: null,
                        valueAddress: null,
                        valuePerson: null,
                        valueLe: null,
                        valueOrg: null,
                        attachmentDocumentId: null,
                        evidence: null,
                        assertedAt: new Date('2026-09-01T10:00:00Z'),
                    },
                ];
            }
            return [];
        });

        const summary = await resolveCCAddressUsages(clientLEId, [targetAddressId]);

        expect(summary[targetAddressId]).toBeDefined();
        expect(summary[targetAddressId].fieldUsages).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    fieldNo: 274,
                    fieldName: 'Persons of significant control (other)',
                }),
            ])
        );
    });
});
