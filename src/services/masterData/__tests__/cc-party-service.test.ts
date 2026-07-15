import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CCPartyService, CCPartyValidationError } from '../cc-party-service';

vi.mock('@/lib/prisma', () => {
    return {
        default: {
            cCParty: {
                create: vi.fn(),
                update: vi.fn(),
                findUnique: vi.fn()
            },
            fieldClaim: {
                findUnique: vi.fn()
            },
            cCAddress: {
                findMany: vi.fn()
            }
        }
    };
});

import prisma from '@/lib/prisma';

describe('CCPartyService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const validV2Individual = {
        schemaVersion: 2,
        partyType: 'INDIVIDUAL',
        isActiveParty: true,
        emails: [],
        phones: [],
        roles: [],
        sourceIdentifiers: [],
        title: null,
        forenames: 'John',
        surname: 'Doe',
        knownAs: null,
        nationality: [],
        countryOfResidence: null,
        dateOfBirth: null,
        placeOfBirth: null,
        homeAddressRef: null
    };

    describe('create', () => {
        it('should successfully create a valid V2 party', async () => {
            (prisma.cCParty.create as any).mockResolvedValue({ id: 'party-1', clientLEId: 'client-1' });

            const result = await CCPartyService.create({
                clientLEId: 'client-1',
                data: validV2Individual as any,
                createdByUserId: 'user-1'
            });

            expect(prisma.cCParty.create).toHaveBeenCalledWith({
                data: {
                    clientLEId: 'client-1',
                    data: validV2Individual,
                    visibility: 'CLIENT_LE',
                    createdByUserId: 'user-1',
                    updatedByUserId: 'user-1',
                    createdFromClaimId: null
                }
            });
            expect(result.id).toBe('party-1');
        });

        it('should reject non-v2 data', async () => {
            await expect(CCPartyService.create({
                clientLEId: 'client-1',
                data: { schemaVersion: 1 } as any
            })).rejects.toThrow(CCPartyValidationError);
        });

        it('should validate createdFromClaimId existence and scope', async () => {
            (prisma.fieldClaim.findUnique as any).mockResolvedValue({
                id: 'claim-1',
                clientLeScopeId: 'client-2' // Mismatched!
            });

            await expect(CCPartyService.create({
                clientLEId: 'client-1',
                data: validV2Individual as any,
                createdFromClaimId: 'claim-1'
            })).rejects.toThrow('belongs to a different Client LE');

            (prisma.fieldClaim.findUnique as any).mockResolvedValue(null);
            await expect(CCPartyService.create({
                clientLEId: 'client-1',
                data: validV2Individual as any,
                createdFromClaimId: 'claim-1'
            })).rejects.toThrow('does not exist');
        });

        it('should validate batch CCAddress references and distinguish NOT_FOUND from MISMATCH', async () => {
            const dataWithAddresses = {
                ...validV2Individual,
                homeAddressRef: { ccAddressId: 'addr-1' },
                roles: [{
                    correspondenceAddressRef: { ccAddressId: 'addr-1' }, // deduplicated
                    roleType: null,
                    roleTitle: null,
                    isActiveRole: true,
                    company: null,
                    appointedOn: null,
                    resignedOn: null,
                    natureOfControl: []
                }, {
                    correspondenceAddressRef: { ccAddressId: 'addr-2' },
                    roleType: null,
                    roleTitle: null,
                    isActiveRole: true,
                    company: null,
                    appointedOn: null,
                    resignedOn: null,
                    natureOfControl: []
                }]
            };

            // addr-1 is found but mismatched scope, addr-2 is missing completely
            (prisma.cCAddress.findMany as any).mockResolvedValue([
                { id: 'addr-1', clientLEId: 'client-2' }
            ]);

            // Will fail on addr-1 first because it evaluates in order of Set
            await expect(CCPartyService.create({
                clientLEId: 'client-1',
                data: dataWithAddresses as any
            })).rejects.toThrow('belongs to a different Client LE');

            // Fix addr-1 to match, so it fails on addr-2 (missing)
            (prisma.cCAddress.findMany as any).mockResolvedValue([
                { id: 'addr-1', clientLEId: 'client-1' }
            ]);

            await expect(CCPartyService.create({
                clientLEId: 'client-1',
                data: dataWithAddresses as any
            })).rejects.toThrow('CCAddress reference not found');
        });
    });

    describe('update', () => {
        it('should replace aggregate and preserve audit fields', async () => {
            (prisma.cCParty.findUnique as any).mockResolvedValue({
                id: 'party-1',
                clientLEId: 'client-1',
                createdAt: new Date(),
                createdByUserId: 'user-1',
                createdFromClaimId: 'claim-1',
                visibility: 'CLIENT_LE'
            });

            await CCPartyService.update({
                ccPartyId: 'party-1',
                clientLEId: 'client-1',
                data: validV2Individual as any,
                updatedByUserId: 'user-2'
            });

            expect(prisma.cCParty.update).toHaveBeenCalledWith({
                where: { id: 'party-1' },
                data: {
                    data: validV2Individual,
                    updatedByUserId: 'user-2'
                    // Notice createdAt, createdByUserId are NOT overwritten
                }
            });
        });

        it('should enforce client LE scope', async () => {
            (prisma.cCParty.findUnique as any).mockResolvedValue({
                id: 'party-1',
                clientLEId: 'client-2' // mismatched
            });

            await expect(CCPartyService.update({
                ccPartyId: 'party-1',
                clientLEId: 'client-1',
                data: validV2Individual as any
            })).rejects.toThrow('CCParty does not belong to the requested Client LE');
        });
    });
});
