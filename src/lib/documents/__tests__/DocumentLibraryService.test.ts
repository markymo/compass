import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentLibraryService } from '../DocumentLibraryService';
import { ClaimStatus } from '@prisma/client';

vi.mock('@/lib/prisma');
import prismaMock from '@/lib/__mocks__/prisma';

// Simple mock for getMasterFieldDefinition
vi.mock('@/services/masterData/definitionService', () => ({
    getMasterFieldDefinition: vi.fn(async (fieldNo) => ({ fieldName: `Field ${fieldNo}` }))
}));

function makeDoc(overrides: Record<string, any> = {}) {
    return {
        id: `doc-${Math.random()}`,
        clientLEId: 'le-1',
        name: 'test.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024n, // BigInt
        createdAt: new Date(),
        uploadedBy: { id: 'u1', name: 'User One' },
        isDeleted: false,
        ...overrides
    };
}

function makeClaim(overrides: Record<string, any> = {}) {
    return {
        id: `claim-${Math.random()}`,
        fieldNo: 1,
        clientLeScopeId: 'le-1',
        claimRole: 'FILE_ATTACHMENT',
        status: ClaimStatus.ASSERTED,
        instanceId: `inst-${Math.random()}`,
        attachmentDocumentId: null,
        valueJson: null,
        assertedAt: new Date(),
        ...overrides
    };
}

describe('DocumentLibraryService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('listLibraryDocuments', () => {
        it('returns UNUSED for a document with no FieldClaims', async () => {
            const doc1 = makeDoc({ id: 'doc-unused' });
            prismaMock.document.findMany.mockResolvedValueOnce([doc1]);
            prismaMock.fieldClaim.findMany.mockResolvedValueOnce([]);

            const results = await DocumentLibraryService.listLibraryDocuments('le-1');
            expect(results).toHaveLength(1);
            expect(results[0].status).toBe('UNUSED');
            expect(results[0].currentUsageCount).toBe(0);
            expect(results[0].historicalUsageCount).toBe(0);
            expect(results[0].sizeBytes).toBe('1024'); // BigInt serialization
        });

        it('returns IN_USE for an active attached document', async () => {
            const doc = makeDoc({ id: 'doc-active' });
            const inst1 = 'inst-1';
            const claim1 = makeClaim({ instanceId: inst1, attachmentDocumentId: 'doc-active' });
            
            prismaMock.document.findMany.mockResolvedValueOnce([doc]);
            prismaMock.fieldClaim.findMany.mockResolvedValueOnce([claim1]);

            const results = await DocumentLibraryService.listLibraryDocuments('le-1');
            expect(results[0].status).toBe('IN_USE');
            expect(results[0].currentUsageCount).toBe(1);
            expect(results[0].historicalUsageCount).toBe(0);
        });

        it('returns PREVIOUSLY_USED for a document whose only usage is tombstoned', async () => {
            const doc = makeDoc({ id: 'doc-tomb' });
            const inst1 = 'inst-1';
            
            const claim1 = makeClaim({ 
                instanceId: inst1, 
                attachmentDocumentId: 'doc-tomb', 
                assertedAt: new Date('2026-01-01') 
            });
            const tombstone = makeClaim({ 
                instanceId: inst1, 
                attachmentDocumentId: null, 
                valueJson: { tombstone: true }, 
                assertedAt: new Date('2026-01-02') 
            });
            
            prismaMock.document.findMany.mockResolvedValueOnce([doc]);
            prismaMock.fieldClaim.findMany.mockResolvedValueOnce([claim1, tombstone]);

            const results = await DocumentLibraryService.listLibraryDocuments('le-1');
            expect(results[0].status).toBe('PREVIOUSLY_USED');
            expect(results[0].currentUsageCount).toBe(0);
            expect(results[0].historicalUsageCount).toBe(1);
        });

        it('returns IN_USE for a document replaced on one field but current on another', async () => {
            const doc = makeDoc({ id: 'doc-mixed' });
            const instA = 'inst-A';
            const instB = 'inst-B';
            
            // Replaced on instA
            const claimA1 = makeClaim({ instanceId: instA, attachmentDocumentId: 'doc-mixed', assertedAt: new Date('2026-01-01') });
            const claimA2 = makeClaim({ instanceId: instA, attachmentDocumentId: 'other-doc', assertedAt: new Date('2026-01-02') });
            
            // Current on instB
            const claimB1 = makeClaim({ instanceId: instB, attachmentDocumentId: 'doc-mixed', assertedAt: new Date('2026-01-01') });
            
            prismaMock.document.findMany.mockResolvedValueOnce([doc]);
            prismaMock.fieldClaim.findMany.mockResolvedValueOnce([claimA1, claimA2, claimB1]);

            const results = await DocumentLibraryService.listLibraryDocuments('le-1');
            expect(results[0].status).toBe('IN_USE');
            expect(results[0].currentUsageCount).toBe(1); // instB
            expect(results[0].historicalUsageCount).toBe(1); // instA
        });

        it('counts same Document attached twice to the same field under different instanceIds as two usages', async () => {
            const doc = makeDoc({ id: 'doc-double' });
            
            const claimA = makeClaim({ instanceId: 'inst-1', fieldNo: 50, attachmentDocumentId: 'doc-double' });
            const claimB = makeClaim({ instanceId: 'inst-2', fieldNo: 50, attachmentDocumentId: 'doc-double' });
            
            prismaMock.document.findMany.mockResolvedValueOnce([doc]);
            prismaMock.fieldClaim.findMany.mockResolvedValueOnce([claimA, claimB]);

            const results = await DocumentLibraryService.listLibraryDocuments('le-1');
            expect(results[0].currentUsageCount).toBe(2);
        });

        it('returns IN_USE when a reattached Document becomes current again', async () => {
            const doc = makeDoc({ id: 'doc-reattached' });
            const inst1 = 'inst-1';
            
            const c1 = makeClaim({ instanceId: inst1, attachmentDocumentId: 'doc-reattached', assertedAt: new Date('2026-01-01') });
            const c2 = makeClaim({ instanceId: inst1, attachmentDocumentId: 'other-doc', assertedAt: new Date('2026-01-02') });
            const c3 = makeClaim({ instanceId: inst1, attachmentDocumentId: 'doc-reattached', assertedAt: new Date('2026-01-03') }); // reattached
            
            prismaMock.document.findMany.mockResolvedValueOnce([doc]);
            prismaMock.fieldClaim.findMany.mockResolvedValueOnce([c1, c2, c3]);

            const results = await DocumentLibraryService.listLibraryDocuments('le-1');
            expect(results[0].status).toBe('IN_USE');
            expect(results[0].currentUsageCount).toBe(1);
            expect(results[0].historicalUsageCount).toBe(0); // It's currently active, so not historical in this instance
        });

        it('queries correctly and remains batched', async () => {
            prismaMock.document.findMany.mockResolvedValueOnce([]);
            await DocumentLibraryService.listLibraryDocuments('le-1');
            
            // Ensure no claims queried if no docs (already covered by early return)
            expect(prismaMock.fieldClaim.findMany).not.toHaveBeenCalled();
            
            prismaMock.document.findMany.mockResolvedValueOnce([makeDoc()]);
            prismaMock.fieldClaim.findMany.mockResolvedValueOnce([]);
            await DocumentLibraryService.listLibraryDocuments('le-1');
            
            // Should query claims exactly once per list call
            expect(prismaMock.fieldClaim.findMany).toHaveBeenCalledTimes(1);
        });
    });

    describe('getDocumentDetails', () => {
        it('throws if document belongs to another LE', async () => {
            const doc = makeDoc({ id: 'doc-1', clientLEId: 'le-other' });
            prismaMock.document.findUnique.mockResolvedValueOnce(doc);
            
            await expect(DocumentLibraryService.getDocumentDetails('doc-1', 'le-1'))
                .rejects.toThrow('Unauthorized access');
        });

        it('reconstructs historical event timeline correctly', async () => {
            const doc = makeDoc({ id: 'doc-events' });
            const inst1 = 'inst-1';
            
            const c1 = makeClaim({ instanceId: inst1, attachmentDocumentId: 'doc-events', assertedAt: new Date('2026-01-01') });
            const c2 = makeClaim({ instanceId: inst1, attachmentDocumentId: 'other-doc', assertedAt: new Date('2026-01-02') });
            
            prismaMock.document.findUnique.mockResolvedValueOnce(doc);
            prismaMock.fieldClaim.findMany
                .mockResolvedValueOnce([{ instanceId: inst1 }]) // instances lookup
                .mockResolvedValueOnce([c1, c2]); // full history
                
            const result = await DocumentLibraryService.getDocumentDetails('doc-events', 'le-1');
            
            expect(result.status).toBe('PREVIOUSLY_USED');
            expect(result.currentUsages).toHaveLength(0);
            
            expect(result.usageHistory).toHaveLength(2);
            // sorted newest first
            expect(result.usageHistory[0].action).toBe('REPLACED');
            expect(result.usageHistory[0].replacementDocumentId).toBe('other-doc');
            expect(result.usageHistory[1].action).toBe('ATTACHED');
        });

        it('maintains parity between list and detail usage counts', async () => {
            const doc = makeDoc({ id: 'doc-parity' });
            const inst1 = 'inst-1'; // replaced -> historical
            const inst2 = 'inst-2'; // active -> current
            
            const c1 = makeClaim({ instanceId: inst1, attachmentDocumentId: 'doc-parity', assertedAt: new Date('2026-01-01') });
            const c2 = makeClaim({ instanceId: inst1, attachmentDocumentId: 'other-doc', assertedAt: new Date('2026-01-02') });
            const c3 = makeClaim({ instanceId: inst2, attachmentDocumentId: 'doc-parity', assertedAt: new Date('2026-01-01') });
            
            prismaMock.document.findMany.mockResolvedValueOnce([doc]);
            prismaMock.fieldClaim.findMany.mockResolvedValueOnce([c1, c2, c3]);
            const listResults = await DocumentLibraryService.listLibraryDocuments('le-1');
            
            prismaMock.document.findUnique.mockResolvedValueOnce(doc);
            prismaMock.fieldClaim.findMany
                .mockResolvedValueOnce([{ instanceId: inst1 }, { instanceId: inst2 }])
                .mockResolvedValueOnce([c1, c2, c3]);
                
            const detailResult = await DocumentLibraryService.getDocumentDetails('doc-parity', 'le-1');
            
            expect(listResults[0].currentUsageCount).toBe(detailResult.currentUsages.length);
            expect(listResults[0].historicalUsageCount).toBe(detailResult.historicalUsageCount);
        });
    });
});
