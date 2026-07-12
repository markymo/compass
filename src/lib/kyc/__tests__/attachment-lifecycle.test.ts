import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KycStateService } from '@/lib/kyc/KycStateService';
import { ClaimStatus } from '@prisma/client';

vi.mock('@/lib/prisma');
vi.mock('@/services/masterData/definitionService');

import prismaMock from '@/lib/__mocks__/prisma';

function makeAttachmentClaim(overrides: Record<string, any> = {}): any {
    return {
        id: `claim-${Math.random().toString(36).slice(2)}`,
        fieldNo: 999, // Attachment test field
        subjectLeId: 'le-123',
        subjectPersonId: null,
        subjectOrgId: null,
        ownerScopeId: null,
        claimRole: 'FILE_ATTACHMENT',
        status: ClaimStatus.VERIFIED,
        sourceType: 'USER_INPUT',
        instanceId: `inst-${Math.random().toString(36).slice(2)}`,
        attachmentDocumentId: `doc-${Math.random().toString(36).slice(2)}`,
        valueJson: null,
        assertedAt: new Date(),
        ...overrides
    };
}

describe('KycStateService.getAuthoritativeAttachments', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('resolves active attachments chronologically by original addition', async () => {
        const inst1 = 'inst-1';
        const inst2 = 'inst-2';

        const claims = [
            makeAttachmentClaim({
                instanceId: inst1,
                attachmentDocumentId: 'doc-A',
                assertedAt: new Date('2026-01-01T10:00:00Z'),
                id: 'claim-A1'
            }),
            makeAttachmentClaim({
                instanceId: inst2,
                attachmentDocumentId: 'doc-B',
                assertedAt: new Date('2026-01-02T10:00:00Z'),
                id: 'claim-B1'
            }),
            makeAttachmentClaim({
                instanceId: inst1,
                attachmentDocumentId: 'doc-A-replaced',
                assertedAt: new Date('2026-01-03T10:00:00Z'),
                id: 'claim-A2'
            })
        ];

        // findMany returns claims ordered by assertedAt desc
        const mockClaims = [...claims].sort((a, b) => b.assertedAt.getTime() - a.assertedAt.getTime());
        (prismaMock.fieldClaim.findMany as any).mockResolvedValue(mockClaims);

        const results = await KycStateService.getAuthoritativeAttachments({ subjectLeId: 'le-123' }, 999);

        // Should return exactly 2 active attachments
        expect(results).toHaveLength(2);

        // They should be chronologically ordered by their *first* assertedAt (A then B)
        // Even though A was replaced on Jan 3, its original instance started on Jan 1
        expect(results[0].attachmentDocumentId).toBe('doc-A-replaced');
        expect(results[1].attachmentDocumentId).toBe('doc-B');
    });

    it('filters out tombstones and correctly terminates the lifecycle', async () => {
        const inst1 = 'inst-1';
        const inst2 = 'inst-2';

        const claims = [
            makeAttachmentClaim({
                instanceId: inst1,
                attachmentDocumentId: 'doc-A',
                assertedAt: new Date('2026-01-01T10:00:00Z'),
                id: 'claim-A1'
            }),
            makeAttachmentClaim({
                instanceId: inst2,
                attachmentDocumentId: 'doc-B',
                assertedAt: new Date('2026-01-02T10:00:00Z'),
                id: 'claim-B1'
            }),
            // Tombstone for inst1
            makeAttachmentClaim({
                instanceId: inst1,
                attachmentDocumentId: null,
                valueJson: { tombstone: true },
                assertedAt: new Date('2026-01-03T10:00:00Z'),
                id: 'claim-A2'
            })
        ];

        const mockClaims = [...claims].sort((a, b) => b.assertedAt.getTime() - a.assertedAt.getTime());
        (prismaMock.fieldClaim.findMany as any).mockResolvedValue(mockClaims);

        const results = await KycStateService.getAuthoritativeAttachments({ subjectLeId: 'le-123' }, 999);

        // inst1 was tombstoned, only inst2 should remain
        expect(results).toHaveLength(1);
        expect(results[0].attachmentDocumentId).toBe('doc-B');
    });

    it('applies snapshotDate to travel back in time', async () => {
        const inst1 = 'inst-1';

        const claims = [
            makeAttachmentClaim({
                instanceId: inst1,
                attachmentDocumentId: 'doc-A',
                assertedAt: new Date('2026-01-01T10:00:00Z'),
                id: 'claim-A1'
            }),
            // Tombstone for inst1
            makeAttachmentClaim({
                instanceId: inst1,
                valueJson: { tombstone: true },
                assertedAt: new Date('2026-01-03T10:00:00Z'),
                id: 'claim-A2'
            })
        ];

        // 1. Querying *after* tombstone (current date) -> should be empty
        let mockClaims = [...claims].sort((a, b) => b.assertedAt.getTime() - a.assertedAt.getTime());
        (prismaMock.fieldClaim.findMany as any).mockResolvedValue(mockClaims);
        
        let results = await KycStateService.getAuthoritativeAttachments({ subjectLeId: 'le-123' }, 999);
        expect(results).toHaveLength(0);

        // 2. Querying *before* tombstone (Jan 2) -> should show active doc-A
        const snapshotDate = new Date('2026-01-02T10:00:00Z');
        mockClaims = claims.filter(c => c.assertedAt <= snapshotDate).sort((a, b) => b.assertedAt.getTime() - a.assertedAt.getTime());
        (prismaMock.fieldClaim.findMany as any).mockResolvedValue(mockClaims);

        results = await KycStateService.getAuthoritativeAttachments({ subjectLeId: 'le-123' }, 999, snapshotDate);
        expect(results).toHaveLength(1);
        expect(results[0].attachmentDocumentId).toBe('doc-A');
    });
});
