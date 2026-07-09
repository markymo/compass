import { describe, it, expect, vi, beforeEach } from 'vitest';
import { previewRestoreSourceValue, restoreSourceValue } from '../kyc-manual-update';
import { FieldClaimService } from '@/lib/kyc/FieldClaimService';

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn()
}));

vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: 'user-123' })
}));

vi.mock('@/lib/kyc/FieldClaimService', () => ({
    FieldClaimService: {
        rejectClaim: vi.fn().mockResolvedValue(true)
    }
}));

const mockFindManyClaims = vi.fn();
const mockFindUniqueClaim = vi.fn();

vi.mock('@/lib/prisma', () => {
    return {
        default: {
            clientLE: {
                findUnique: vi.fn().mockResolvedValue({ id: 'le-123', legalEntityId: 'le-abc', registryReferences: [] }),
                findFirst: vi.fn().mockResolvedValue({ id: 'le-123', legalEntityId: 'le-abc', registryReferences: [] })
            },
            clientLEOwner: {
                findFirst: vi.fn().mockResolvedValue({ partyId: 'party-owner-123' })
            },
            fieldClaim: {
                findMany: (...args: any[]) => mockFindManyClaims(...args),
                findUnique: (...args: any[]) => mockFindUniqueClaim(...args)
            },
            sourceFieldMapping: {
                findMany: vi.fn().mockResolvedValue([
                    { sourceType: 'USER_INPUT', sourceReference: null, priorityLevel: 1 },
                    { sourceType: 'GLEIF', sourceReference: null, priorityLevel: 2 }
                ])
            }
        }
    };
});

describe('Restore Source Value Feature', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('1. Address field with GLEIF claim only', () => {
        it('preview returns no restore action because current winner is not USER_INPUT', async () => {
            mockFindManyClaims.mockResolvedValue([
                { id: 'claim-1', fieldNo: 205, sourceType: 'GLEIF', status: 'ASSERTED', ownerScopeId: null, valueJson: { text: "123 Gleif St" }, subjectLeId: 'le-abc' }
            ]);

            const res = await previewRestoreSourceValue('le-123', 205);
            
            expect(res.success).toBe(true);
            expect(res.preview).toBeNull();
        });
    });

    describe('2. Address field with GLEIF claim + USER_INPUT override', () => {
        const claims = [
            { id: 'claim-2', fieldNo: 205, sourceType: 'USER_INPUT', status: 'ASSERTED', ownerScopeId: null, valueJson: { text: "456 User St" }, subjectLeId: 'le-abc', assertedAt: new Date('2023-02-01') },
            { id: 'claim-1', fieldNo: 205, sourceType: 'GLEIF', status: 'ASSERTED', ownerScopeId: null, valueJson: { text: "123 Gleif St" }, subjectLeId: 'le-abc', assertedAt: new Date('2023-01-01') }
        ];

        it('preview identifies USER_INPUT as current winner and shows GLEIF as next', async () => {
            mockFindManyClaims.mockResolvedValue(claims);

            const res = await previewRestoreSourceValue('le-123', 205);
            
            expect(res.success).toBe(true);
            expect(res.preview).not.toBeNull();
            expect(res.preview?.currentWinnerClaimId).toBe('claim-2');
            expect(res.preview?.nextDerivedValue?.value).toEqual({ text: "123 Gleif St" });
        });

        it('restore marks only that USER_INPUT claim as REJECTED', async () => {
            mockFindUniqueClaim.mockResolvedValue(claims[0]); // claim-2 is the USER_INPUT
            
            const res = await restoreSourceValue('le-123', 205, 'claim-2');
            
            expect(res.success).toBe(true);
            expect(FieldClaimService.rejectClaim).toHaveBeenCalledWith('claim-2');
            expect(FieldClaimService.rejectClaim).toHaveBeenCalledTimes(1);
        });
    });

    describe('3. Address field with GLEIF claim + USER_INPUT explicit-none/tombstone', () => {
        const claims = [
            { id: 'claim-3', fieldNo: 205, sourceType: 'USER_INPUT', status: 'ASSERTED', ownerScopeId: null, explicitNone: true, subjectLeId: 'le-abc', assertedAt: new Date('2023-02-01') },
            { id: 'claim-1', fieldNo: 205, sourceType: 'GLEIF', status: 'ASSERTED', ownerScopeId: null, valueJson: { text: "123 Gleif St" }, subjectLeId: 'le-abc', assertedAt: new Date('2023-01-01') }
        ];

        it('preview still identifies the tombstone claim and shows GLEIF as next', async () => {
            mockFindManyClaims.mockResolvedValue(claims);

            const res = await previewRestoreSourceValue('le-123', 205);
            
            expect(res.success).toBe(true);
            expect(res.preview).not.toBeNull();
            expect(res.preview?.currentWinnerClaimId).toBe('claim-3');
            expect(res.preview?.nextDerivedValue?.value).toEqual({ text: "123 Gleif St" });
        });

        it('restore rejects the tombstone', async () => {
            mockFindUniqueClaim.mockResolvedValue(claims[0]); // claim-3 is the tombstone
            
            const res = await restoreSourceValue('le-123', 205, 'claim-3');
            
            expect(res.success).toBe(true);
            expect(FieldClaimService.rejectClaim).toHaveBeenCalledWith('claim-3');
        });
    });

    describe('4. Safety test', () => {
        it('restore must not reject unrelated USER_INPUT claims for another field or older historical claims', async () => {
            // Attempt to reject a historical/rejected claim
            mockFindUniqueClaim.mockResolvedValue({
                id: 'claim-old', fieldNo: 205, sourceType: 'USER_INPUT', status: 'REJECTED', subjectLeId: 'le-abc'
            });
            let res = await restoreSourceValue('le-123', 205, 'claim-old');
            expect(res.success).toBe(false);
            expect(res.message).toBe("Claim is not active");

            // Attempt to reject a claim for a different field
            mockFindUniqueClaim.mockResolvedValue({
                id: 'claim-diff', fieldNo: 999, sourceType: 'USER_INPUT', status: 'ASSERTED', subjectLeId: 'le-abc'
            });
            res = await restoreSourceValue('le-123', 205, 'claim-diff');
            expect(res.success).toBe(false);
            expect(res.message).toBe("Claim field number mismatch");

            expect(FieldClaimService.rejectClaim).not.toHaveBeenCalled();
        });
    });
});
