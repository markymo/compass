import { describe, it, expect, vi, beforeEach } from 'vitest';
import { attachPartyDocument, replacePartyDocument, removePartyDocument, listPartyDocuments } from '../party-document-actions';
import { CCPartyDocumentService } from '@/lib/documents/party/CCPartyDocumentService';
import { ensureApiAuthorization } from '@/lib/auth/api-auth';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

vi.mock('@/lib/auth/api-auth', () => ({
    ensureApiAuthorization: vi.fn()
}));

vi.mock('@/lib/documents/party/CCPartyDocumentService', () => ({
    CCPartyDocumentService: {
        attachDocument: vi.fn(),
        replaceDocument: vi.fn(),
        removeDocument: vi.fn(),
        resolvePartyDocuments: vi.fn()
    }
}));

vi.mock('@/lib/prisma', () => ({
    default: {
        cCParty: {
            findUnique: vi.fn()
        },
        document: {
            findMany: vi.fn()
        }
    }
}));

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn()
}));

describe('party-document-actions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (ensureApiAuthorization as any).mockResolvedValue({ userId: 'user-1' });
        (prisma.cCParty.findUnique as any).mockResolvedValue({ id: 'party-1', clientLEId: 'le-1' });
    });

    describe('attachPartyDocument', () => {
        it('calls CCPartyDocumentService.attachDocument and revalidates path', async () => {
            (CCPartyDocumentService.attachDocument as any).mockResolvedValue({ id: 'event-1' });
            
            await attachPartyDocument({
                clientLEId: 'le-1',
                partyId: 'party-1',
                documentId: 'doc-1',
                idempotencyKey: 'idem-1'
            });

            expect(CCPartyDocumentService.attachDocument).toHaveBeenCalledWith({
                partyId: 'party-1',
                documentId: 'doc-1',
                idempotencyKey: 'idem-1',
                assertedById: 'user-1'
            });
            expect(revalidatePath).toHaveBeenCalledWith('/client/le-1/parties/party-1');
        });
    });

    describe('replacePartyDocument', () => {
        it('calls CCPartyDocumentService.replaceDocument and revalidates path', async () => {
            await replacePartyDocument({
                clientLEId: 'le-1',
                partyId: 'party-1',
                instanceId: 'inst-1',
                documentId: 'doc-2',
                idempotencyKey: 'idem-2'
            });

            expect(CCPartyDocumentService.replaceDocument).toHaveBeenCalledWith({
                partyId: 'party-1',
                instanceId: 'inst-1',
                documentId: 'doc-2',
                idempotencyKey: 'idem-2',
                assertedById: 'user-1'
            });
            expect(revalidatePath).toHaveBeenCalledWith('/client/le-1/parties/party-1');
        });
    });

    describe('removePartyDocument', () => {
        it('calls CCPartyDocumentService.removeDocument and revalidates path', async () => {
            await removePartyDocument({
                clientLEId: 'le-1',
                partyId: 'party-1',
                instanceId: 'inst-1',
                idempotencyKey: 'idem-3'
            });

            expect(CCPartyDocumentService.removeDocument).toHaveBeenCalledWith({
                partyId: 'party-1',
                instanceId: 'inst-1',
                idempotencyKey: 'idem-3',
                assertedById: 'user-1'
            });
            expect(revalidatePath).toHaveBeenCalledWith('/client/le-1/parties/party-1');
        });
    });

    describe('listPartyDocuments', () => {
        it('calls CCPartyDocumentService.resolvePartyDocuments and maps with Document data', async () => {
            (CCPartyDocumentService.resolvePartyDocuments as any).mockResolvedValue([
                {
                    instanceId: 'inst-1',
                    currentDocumentId: 'doc-1',
                    events: [{ assertedAt: new Date('2026-07-17T12:00:00Z') }]
                }
            ]);

            (prisma.document.findMany as any).mockResolvedValue([
                { id: 'doc-1', originalFilename: 'test.pdf', sizeBytes: 1024, createdAt: new Date('2026-07-17T11:00:00Z') }
            ]);

            const result = await listPartyDocuments({
                clientLEId: 'le-1',
                partyId: 'party-1'
            });

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                instanceId: 'inst-1',
                documentId: 'doc-1',
                originalFilename: 'test.pdf',
                sizeBytes: 1024,
                createdAt: new Date('2026-07-17T11:00:00Z'),
                attachedAt: new Date('2026-07-17T12:00:00Z')
            });
        });
    });
});
