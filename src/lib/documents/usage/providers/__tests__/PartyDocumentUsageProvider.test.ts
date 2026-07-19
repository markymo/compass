import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PartyDocumentUsageProvider } from '../PartyDocumentUsageProvider';
import { CCPartyDocumentService } from '@/lib/documents/party/CCPartyDocumentService';
import prisma from '@/lib/prisma';

vi.mock('@/lib/documents/party/CCPartyDocumentService');
vi.mock('@/lib/prisma', () => ({
    default: {
        cCParty: {
            findMany: vi.fn()
        }
    }
}));

describe('PartyDocumentUsageProvider', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('maps active attachments to DocumentUsage structure with Party name', async () => {
        const provider = new PartyDocumentUsageProvider();
        const mockDate = new Date('2026-07-17T12:00:00Z');

        (CCPartyDocumentService.getActiveAttachmentsForDocuments as any).mockResolvedValue([
            {
                instanceId: 'inst-1',
                partyId: 'party-1',
                currentDocumentId: 'doc-1',
                isRemoved: false,
                events: [{ assertedAt: mockDate }]
            }
        ]);

        (prisma.cCParty.findMany as any).mockResolvedValue([
            { id: 'party-1', data: { name: 'Acme Corp' } }
        ]);

        const usages = await provider.getActiveUsages('client-1', ['doc-1']);

        expect(usages).toHaveLength(1);
        expect(usages[0]).toEqual({
            documentId: 'doc-1',
            type: 'PARTY_DOCUMENT',
            instanceId: 'inst-1',
            attachedAt: mockDate,
            isActive: true,
            display: {
                title: 'Organisation',
                subtitle: 'Acme Corp'
            },
            metadata: {
                partyId: 'party-1'
            }
        });
    });

    it('handles missing party data gracefully', async () => {
        const provider = new PartyDocumentUsageProvider();

        (CCPartyDocumentService.getActiveAttachmentsForDocuments as any).mockResolvedValue([
            {
                instanceId: 'inst-1',
                partyId: 'party-unknown',
                currentDocumentId: 'doc-1',
                isRemoved: false,
                events: [{ assertedAt: new Date() }]
            }
        ]);

        (prisma.cCParty.findMany as any).mockResolvedValue([]);

        const usages = await provider.getActiveUsages('client-1', ['doc-1']);

        expect(usages[0].display.subtitle).toBe('Unknown Party');
    });
});
