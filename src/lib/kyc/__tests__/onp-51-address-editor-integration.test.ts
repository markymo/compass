import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '@/lib/prisma';
import { FieldClaimService } from '@/lib/kyc/FieldClaimService';
import { KycStateService } from '@/lib/kyc/KycStateService';
import { ClaimStatus, SourceType } from '@prisma/client';

// Mock Auth
vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockResolvedValue({
        userId: 'usr-onp51-test',
        email: 'test-onp51@onpro.tech'
    })
}));

describe('ONP-51 / ONP-52 — Existing Address Editing & History Immutability Integration', () => {
    const clientLEId = 'le-onp51-test';
    const subjectLeId = 'legal-entity-onp51';
    const fieldNo = 138; // Registered address (appDataType: ADDRESS)

    beforeEach(async () => {
        // Clean up test data
        await prisma.fieldClaim.deleteMany({
            where: { clientLEId }
        });
        await prisma.clientLE.deleteMany({
            where: { id: clientLEId }
        });
        await prisma.legalEntity.deleteMany({
            where: { id: subjectLeId }
        });
        await prisma.user.deleteMany({
            where: { email: 'test-onp51@onpro.tech' }
        });

        // Setup base User, LE, and ClientLE
        await prisma.user.create({
            data: {
                id: 'usr-onp51-test',
                email: 'test-onp51@onpro.tech',
                name: 'Compliance Officer'
            }
        });
        await prisma.legalEntity.create({
            data: {
                id: subjectLeId,
                name: 'Address Test Firm LE',
                reference: 'REF-ONP51'
            }
        });
        await prisma.clientLE.create({
            data: {
                id: clientLEId,
                legalEntityId: subjectLeId,
                name: 'Address Test Firm Client LE'
            }
        });
    });

    it('Allows modifying an existing address by creating a new USER_INPUT claim without mutating prior claim', async () => {
        // Step 1: Initial existing address asserted from registry
        const initialAddressJson = {
            addressLines: ['100 Old Broad Street'],
            locality: 'London',
            region: 'Greater London',
            postalCode: 'EC2N 1AR',
            countryCode: 'GB',
            countryName: 'United Kingdom'
        };

        const initialClaim = await prisma.fieldClaim.create({
            data: {
                clientLEId,
                subjectLeId,
                fieldNo,
                claimRole: 'VALUE',
                status: ClaimStatus.VERIFIED,
                sourceType: SourceType.COMPANIES_HOUSE,
                sourceReference: 'Companies House',
                valueJson: initialAddressJson,
                instanceId: 'inst-addr-1',
                assertedAt: new Date('2026-08-01T10:00:00Z')
            }
        });
        expect(initialClaim.id).toBeDefined();

        // Check authoritative value before edit
        const initialAuth = await KycStateService.getAuthoritativeValue(
            { clientLEId, subjectLeId },
            fieldNo
        );
        expect(initialAuth).toBeDefined();
        expect(initialAuth?.value).toEqual(initialAddressJson);

        // Step 2: User edits existing address via Drawer
        const updatedAddressJson = {
            addressLines: ['100 Old Broad Street', 'Level 4'],
            locality: 'London',
            region: 'Greater London',
            postalCode: 'EC2N 1AR',
            countryCode: 'GB',
            countryName: 'United Kingdom'
        };

        const editClaim = await FieldClaimService.assertClaim({
            clientLEId,
            subjectLeId,
            fieldNo,
            claimRole: 'VALUE',
            sourceType: SourceType.USER_INPUT,
            sourceReference: 'Manual amendment in Master Drawer',
            valueJson: updatedAddressJson,
            instanceId: 'inst-addr-1',
            status: ClaimStatus.VERIFIED,
            assertedAt: new Date('2026-08-20T10:00:00Z')
        });
        expect(editClaim.id).toBeDefined();
        expect(editClaim.id).not.toBe(initialClaim.id);

        // Step 3: Prior claim is unchanged in history
        const historicalClaims = await prisma.fieldClaim.findMany({
            where: { clientLEId, fieldNo },
            orderBy: { assertedAt: 'asc' }
        });
        expect(historicalClaims.length).toBe(2);
        expect(historicalClaims[0].id).toBe(initialClaim.id);
        expect(historicalClaims[0].valueJson).toEqual(initialAddressJson);
        expect(historicalClaims[1].id).toBe(editClaim.id);
        expect(historicalClaims[1].valueJson).toEqual(updatedAddressJson);

        // Step 4: Authoritative value resolves the newly edited address
        const updatedAuth = await KycStateService.getAuthoritativeValue(
            { clientLEId, subjectLeId },
            fieldNo
        );
        expect(updatedAuth).toBeDefined();
        expect(updatedAuth?.value).toEqual(updatedAddressJson);
    });
});
