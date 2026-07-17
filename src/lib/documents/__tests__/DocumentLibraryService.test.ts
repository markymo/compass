import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentLibraryService } from '../DocumentLibraryService';
import { DocumentUsageResolver } from '../usage/DocumentUsageResolver';
import { DocumentUsageHistoryResolver } from '../usage/DocumentUsageHistoryResolver';

vi.mock('@/lib/prisma');
import prismaMock from '@/lib/__mocks__/prisma';

vi.mock('../usage/DocumentUsageResolver');
vi.mock('../usage/DocumentUsageHistoryResolver');

function makeDoc(overrides: Record<string, any> = {}) {
    return {
        id: `doc-${Math.random()}`,
        clientLEId: 'le-1',
        name: 'test.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024n,
        createdAt: new Date('2026-07-17T12:00:00Z'),
        uploadedBy: { id: 'u1', name: 'User One' },
        isDeleted: false,
        ...overrides
    };
}

describe('DocumentLibraryService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('listLibraryDocuments', () => {
        it('returns UNUSED for a document with no usages', async () => {
            const doc1 = makeDoc({ id: 'doc-unused' });
            prismaMock.document.findMany.mockResolvedValueOnce([doc1]);
            (DocumentUsageResolver.resolveActiveUsages as any).mockResolvedValueOnce(new Map());
            (DocumentUsageHistoryResolver.resolveHistory as any).mockResolvedValueOnce(new Map());

            const result = await DocumentLibraryService.listLibraryDocuments('le-1');
            
            expect(result).toHaveLength(1);
            expect(result[0].status).toBe('UNUSED');
            expect(result[0].currentUsageCount).toBe(0);
        });

        it('returns IN_USE for a document with usages', async () => {
            const doc1 = makeDoc({ id: 'doc-used' });
            prismaMock.document.findMany.mockResolvedValueOnce([doc1]);
            
            const usages = [
                { type: 'FIELD_ATTACHMENT', instanceId: 'i1', attachedAt: new Date(), isActive: true, display: { title: 'F1' }, metadata: {} }
            ];
            const usageMap = new Map();
            usageMap.set('doc-used', usages);
            
            (DocumentUsageResolver.resolveActiveUsages as any).mockResolvedValueOnce(usageMap);
            (DocumentUsageHistoryResolver.resolveHistory as any).mockResolvedValueOnce(new Map());

            const result = await DocumentLibraryService.listLibraryDocuments('le-1');
            
            expect(result).toHaveLength(1);
            expect(result[0].status).toBe('IN_USE');
            expect(result[0].currentUsageCount).toBe(1);
        });
    });

    describe('getDocumentDetails', () => {
        it('throws if document not found', async () => {
            prismaMock.document.findUnique.mockResolvedValueOnce(null);
            await expect(DocumentLibraryService.getDocumentDetails('doc-1', 'le-1')).rejects.toThrow('Document not found');
        });

        it('returns details with usages', async () => {
            const doc1 = makeDoc({ id: 'doc-1' });
            prismaMock.document.findUnique.mockResolvedValueOnce(doc1);

            const usages = [
                { type: 'PARTY_DOCUMENT', instanceId: 'i2', attachedAt: new Date('2026-07-17T12:30:00Z'), isActive: true, display: { title: 'Org', subtitle: 'ABC' }, metadata: { partyId: 'p1' } }
            ];
            const usageMap = new Map();
            usageMap.set('doc-1', usages);

            (DocumentUsageResolver.resolveActiveUsages as any).mockResolvedValueOnce(usageMap);
            (DocumentUsageHistoryResolver.resolveHistory as any).mockResolvedValueOnce(new Map());

            const details = await DocumentLibraryService.getDocumentDetails('doc-1', 'le-1');
            
            expect(details.id).toBe('doc-1');
            expect(details.status).toBe('IN_USE');
            expect(details.currentUsages).toHaveLength(1);
            expect(details.currentUsages[0].display.subtitle).toBe('ABC');
        });
    });
});
