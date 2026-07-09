import { describe, it, expect, vi, beforeEach } from 'vitest';
import { restoreSourceValue } from '../kyc-manual-update';
import { KycStateService } from '@/lib/kyc/KycStateService';

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn()
}));

vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: 'user-123' })
}));

vi.mock('@/lib/kyc/KycStateService', () => ({
    KycStateService: {
        resolveScopeId: vi.fn().mockResolvedValue('scope-123')
    }
}));

const mockUpdateMany = vi.fn();

vi.mock('@/lib/prisma', () => {
    return {
        default: {
            clientLE: {
                findUnique: vi.fn().mockResolvedValue({ id: 'le-123', legalEntityId: 'le-abc' })
            },
            fieldClaim: {
                updateMany: (...args: any[]) => mockUpdateMany(...args)
            },
            masterFieldDefinition: {
                findMany: vi.fn().mockResolvedValue([
                    { fieldNo: 205, fieldName: 'Address', appDataType: 'ADDRESS' },
                    { fieldNo: 999, fieldName: 'Other', appDataType: 'TEXT' }
                ])
            }
        }
    };
});

describe('Restore Source Value Feature', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUpdateMany.mockResolvedValue({ count: 1 });
    });

    describe('Bulk rejection behaviour', () => {
        it('rejects all active USER_INPUT claims for the specified address field and scope', async () => {
            const res = await restoreSourceValue('le-123', 205);
            
            expect(res.success).toBe(true);
            expect(mockUpdateMany).toHaveBeenCalledWith({
                where: {
                    subjectLeId: 'le-abc',
                    fieldNo: 205,
                    sourceType: 'USER_INPUT',
                    status: { in: ['ASSERTED', 'VERIFIED'] },
                    OR: [
                        { ownerScopeId: 'scope-123' },
                        { ownerScopeId: null }
                    ]
                },
                data: {
                    status: 'REJECTED'
                }
            });
        });

        it('fails for non-Address fields', async () => {
            const res = await restoreSourceValue('le-123', 999);
            
            expect(res.success).toBe(false);
            expect(res.message).toBe("Bulk restore is currently only supported for Address fields");
            expect(mockUpdateMany).not.toHaveBeenCalled();
        });
    });
});
