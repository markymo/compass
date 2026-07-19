import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CCPartyDocumentService } from '../CCPartyDocumentService';
import { CCPartyDocumentOperation } from '@prisma/client';
import prisma from '@/lib/prisma';

// Mock prisma
vi.mock('@/lib/prisma', () => {
    return {
        default: {
            cCParty: {
                findUnique: vi.fn(),
            },
            document: {
                findUnique: vi.fn(),
            },
            cCPartyDocument: {
                findMany: vi.fn(),
                findUnique: vi.fn(),
                create: vi.fn(),
            }
        }
    };
});

describe('CCPartyDocumentService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        
        // Default mocks to pass validation
        (prisma.cCParty.findUnique as any).mockResolvedValue({ id: 'party-1' });
        (prisma.document.findUnique as any).mockResolvedValue({ id: 'doc-1' });
        (prisma.cCPartyDocument.findMany as any).mockResolvedValue([]);
    });

    it('attachDocument should validate and append an ATTACH event', async () => {
        (prisma.cCPartyDocument.create as any).mockResolvedValue({
            id: '1',
            partyId: 'party-1',
            documentId: 'doc-1',
            instanceId: 'inst-1',
            operation: CCPartyDocumentOperation.ATTACH,
        });

        const res = await CCPartyDocumentService.attachDocument({
            partyId: 'party-1',
            documentId: 'doc-1'
        });

        expect(res.operation).toBe(CCPartyDocumentOperation.ATTACH);
        expect(prisma.cCPartyDocument.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                operation: CCPartyDocumentOperation.ATTACH,
                partyId: 'party-1',
                documentId: 'doc-1',
            })
        }));
    });

    it('replaceDocument should validate the existing instance and append a REPLACE event', async () => {
        // Mock existing instance
        (prisma.cCPartyDocument.findMany as any).mockResolvedValue([{
            id: '1',
            partyId: 'party-1',
            documentId: 'doc-A',
            instanceId: 'inst-1',
            operation: CCPartyDocumentOperation.ATTACH,
        }]);

        (prisma.cCPartyDocument.create as any).mockResolvedValue({
            id: '2',
            partyId: 'party-1',
            documentId: 'doc-1',
            instanceId: 'inst-1',
            operation: CCPartyDocumentOperation.REPLACE,
        });

        const res = await CCPartyDocumentService.replaceDocument({
            partyId: 'party-1',
            instanceId: 'inst-1',
            documentId: 'doc-1',
        });

        expect(res.operation).toBe(CCPartyDocumentOperation.REPLACE);
        expect(res.instanceId).toBe('inst-1');
        expect(prisma.cCPartyDocument.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                operation: CCPartyDocumentOperation.REPLACE,
                instanceId: 'inst-1'
            })
        }));
    });

    it('removeDocument should append a REMOVE event with the previous documentId', async () => {
        // Mock existing instance
        (prisma.cCPartyDocument.findMany as any).mockResolvedValue([{
            id: '1',
            partyId: 'party-1',
            documentId: 'doc-A',
            instanceId: 'inst-1',
            operation: CCPartyDocumentOperation.ATTACH,
        }]);

        (prisma.cCPartyDocument.create as any).mockResolvedValue({
            id: '2',
            partyId: 'party-1',
            documentId: 'doc-A', // Carried forward
            instanceId: 'inst-1',
            operation: CCPartyDocumentOperation.REMOVE,
        });

        const res = await CCPartyDocumentService.removeDocument({
            partyId: 'party-1',
            instanceId: 'inst-1',
        });

        expect(res.operation).toBe(CCPartyDocumentOperation.REMOVE);
        expect(res.documentId).toBe('doc-A');
        expect(prisma.cCPartyDocument.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                operation: CCPartyDocumentOperation.REMOVE,
                documentId: 'doc-A'
            })
        }));
    });

    it('should throw if replacing an already removed instance', async () => {
        (prisma.cCPartyDocument.findMany as any).mockResolvedValue([{
            id: '1',
            partyId: 'party-1',
            documentId: 'doc-A',
            instanceId: 'inst-1',
            operation: CCPartyDocumentOperation.REMOVE,
        }]);

        await expect(CCPartyDocumentService.replaceDocument({
            partyId: 'party-1',
            instanceId: 'inst-1',
            documentId: 'doc-2'
        })).rejects.toThrow(/already been removed/);
    });

    it('enforces idempotency short-circuiting before creation', async () => {
        const existing = {
            id: '1',
            partyId: 'party-1',
            documentId: 'doc-1',
            instanceId: 'inst-1',
            operation: CCPartyDocumentOperation.ATTACH,
        };
        (prisma.cCPartyDocument.findUnique as any).mockResolvedValue(existing);

        const res = await CCPartyDocumentService.attachDocument({
            partyId: 'party-1',
            documentId: 'doc-1',
            idempotencyKey: 'idemp-1'
        });

        expect(res).toEqual(existing);
        expect(prisma.cCPartyDocument.create).not.toHaveBeenCalled();
    });

    it('throws idempotency conflict on mismatched party, document, or operation', async () => {
        const existing = {
            id: '1',
            partyId: 'party-1',
            documentId: 'doc-1',
            instanceId: 'inst-1',
            operation: CCPartyDocumentOperation.ATTACH,
        };
        (prisma.cCPartyDocument.findUnique as any).mockResolvedValue(existing);

        await expect(CCPartyDocumentService.attachDocument({
            partyId: 'party-2', // Different party
            documentId: 'doc-1',
            idempotencyKey: 'idemp-1'
        })).rejects.toThrow(/Idempotency conflict: partyId mismatch/);

        await expect(CCPartyDocumentService.attachDocument({
            partyId: 'party-1',
            documentId: 'doc-2', // Different doc
            idempotencyKey: 'idemp-1'
        })).rejects.toThrow(/Idempotency conflict: documentId mismatch/);
        
        // Mock findMany so validateInstance passes
        (prisma.cCPartyDocument.findMany as any).mockResolvedValue([{
            id: '1',
            partyId: 'party-1',
            documentId: 'doc-1',
            instanceId: 'inst-1',
            operation: CCPartyDocumentOperation.ATTACH,
        }]);

        await expect(CCPartyDocumentService.replaceDocument({
            partyId: 'party-1',
            documentId: 'doc-1',
            instanceId: 'inst-1', // It's ATTACH in db, we are trying REPLACE
            idempotencyKey: 'idemp-1'
        })).rejects.toThrow(/Idempotency conflict: operation mismatch/);
    });

    it('rejects replace on an unknown instanceId or mismatched party', async () => {
        // Mock findMany returning empty (not found)
        (prisma.cCPartyDocument.findMany as any).mockResolvedValue([]);

        await expect(CCPartyDocumentService.replaceDocument({
            partyId: 'party-1',
            instanceId: 'inst-unknown',
            documentId: 'doc-1'
        })).rejects.toThrow(/Instance inst-unknown not found for party party-1/);
    });

    it('rejects replace if new Document does not exist', async () => {
        // Mock document missing
        (prisma.document.findUnique as any).mockResolvedValue(null);

        await expect(CCPartyDocumentService.replaceDocument({
            partyId: 'party-1',
            instanceId: 'inst-1',
            documentId: 'doc-missing'
        })).rejects.toThrow(/Document doc-missing not found/);
    });

    it('getAttachmentHistoryForDocument enforces clientLE scope', async () => {
        (prisma.cCPartyDocument.findMany as any).mockResolvedValueOnce([]); // Mock recordsReferencingDoc empty return
        
        await CCPartyDocumentService.getAttachmentHistoryForDocument('le-1', 'doc-1');

        expect(prisma.cCPartyDocument.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                documentId: 'doc-1',
                party: { clientLEId: 'le-1' }
            })
        }));
    });
});
