import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentUsageResolver } from '../DocumentUsageResolver';
import { FieldAttachmentUsageProvider } from '../providers/FieldAttachmentUsageProvider';
import { PartyDocumentUsageProvider } from '../providers/PartyDocumentUsageProvider';
import { QuestionDocumentUsageProvider } from '../providers/QuestionDocumentUsageProvider';
import { DocumentUsage } from '../types';

vi.mock('../providers/FieldAttachmentUsageProvider');
vi.mock('../providers/PartyDocumentUsageProvider');
vi.mock('../providers/QuestionDocumentUsageProvider');

describe('DocumentUsageResolver', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('resolves active usages across multiple providers and sorts by date', async () => {
        const docId = 'doc-1';
        const clientLEId = 'client-1';

        const fieldUsage: DocumentUsage = {
            documentId: docId,
            type: 'FIELD_ATTACHMENT',
            instanceId: 'inst-1',
            attachedAt: new Date('2026-07-17T10:00:00Z'),
            isActive: true,
            display: { title: 'Field 20', subtitle: 'Incorporation' },
            metadata: { fieldNo: 20 }
        };

        const partyUsage: DocumentUsage = {
            documentId: docId,
            type: 'PARTY_DOCUMENT',
            instanceId: 'inst-2',
            attachedAt: new Date('2026-07-17T09:00:00Z'), // Older
            isActive: true,
            display: { title: 'Organisation', subtitle: 'ABC Ltd' },
            metadata: { partyId: 'party-1' }
        };

        (FieldAttachmentUsageProvider.prototype.getActiveUsages as any).mockResolvedValue([fieldUsage]);
        (PartyDocumentUsageProvider.prototype.getActiveUsages as any).mockResolvedValue([partyUsage]);
        (QuestionDocumentUsageProvider.prototype.getActiveUsages as any).mockResolvedValue([]);

        const result = await DocumentUsageResolver.resolveActiveUsages(clientLEId, [docId]);

        const usages = result.get(docId);
        expect(usages).toHaveLength(2);
        // Party usage is older, should be first
        expect(usages![0]).toEqual(partyUsage);
        expect(usages![1]).toEqual(fieldUsage);
    });

    it('returns empty array when there are no active usages', async () => {
        const docId = 'doc-1';
        const clientLEId = 'client-1';

        (FieldAttachmentUsageProvider.prototype.getActiveUsages as any).mockResolvedValue([]);
        (PartyDocumentUsageProvider.prototype.getActiveUsages as any).mockResolvedValue([]);
        (QuestionDocumentUsageProvider.prototype.getActiveUsages as any).mockResolvedValue([]);

        const result = await DocumentUsageResolver.resolveActiveUsages(clientLEId, [docId]);

        const usages = result.get(docId);
        expect(usages).toEqual([]);
    });

    it('groups multiple document IDs correctly', async () => {
        const docId1 = 'doc-1';
        const docId2 = 'doc-2';
        const clientLEId = 'client-1';

        const fieldUsage: DocumentUsage = {
            documentId: docId1,
            type: 'FIELD_ATTACHMENT',
            instanceId: 'inst-1',
            attachedAt: new Date(),
            isActive: true,
            display: { title: 'Field 20' },
            metadata: { fieldNo: 20 }
        };

        const partyUsage: DocumentUsage = {
            documentId: docId2,
            type: 'PARTY_DOCUMENT',
            instanceId: 'inst-2',
            attachedAt: new Date(),
            isActive: true,
            display: { title: 'Organisation' },
            metadata: { partyId: 'party-1' }
        };

        (FieldAttachmentUsageProvider.prototype.getActiveUsages as any).mockImplementation(async (c: string, docs: string[]) => {
            return docs.includes(docId1) ? [fieldUsage] : [];
        });
        
        (PartyDocumentUsageProvider.prototype.getActiveUsages as any).mockImplementation(async (c: string, docs: string[]) => {
            return docs.includes(docId2) ? [partyUsage] : [];
        });

        (QuestionDocumentUsageProvider.prototype.getActiveUsages as any).mockResolvedValue([]);

        const result = await DocumentUsageResolver.resolveActiveUsages(clientLEId, [docId1, docId2]);

        expect(result.get(docId1)).toEqual([fieldUsage]);
        expect(result.get(docId2)).toEqual([partyUsage]);
    });
});
