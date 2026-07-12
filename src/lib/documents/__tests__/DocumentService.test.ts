import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentService } from '../DocumentService';
import { get, del } from '@vercel/blob';
import prisma from '@/lib/prisma';
import { Readable } from 'stream';
import { Prisma } from '@prisma/client';

// Mock Vercel Blob
vi.mock('@vercel/blob', () => ({
    get: vi.fn(),
    del: vi.fn()
}));

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
    default: {
        document: {
            findUnique: vi.fn(),
            create: vi.fn()
        },
        $transaction: vi.fn(async (cb) => {
            return cb({
                document: {
                    create: vi.fn().mockResolvedValue({ id: 'doc-123' })
                }
            });
        })
    }
}));

// Helper to mock web ReadableStream
function createMockStream(buffer: Buffer) {
    const nodeStream = Readable.from(buffer);
    return {
        getReader: () => {
            const iterator = nodeStream[Symbol.asyncIterator]();
            return {
                read: async () => {
                    const result = await iterator.next();
                    return {
                        done: result.done,
                        value: result.value ? new Uint8Array(result.value) : undefined
                    };
                }
            };
        }
    };
}

describe('DocumentService', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.clearAllMocks();
        process.env = { ...originalEnv, PRIVATE_BLOB_READ_WRITE_TOKEN: 'valid_token' };
    });

    it('should fail closed if PRIVATE_BLOB_READ_WRITE_TOKEN is missing', async () => {
        delete process.env.PRIVATE_BLOB_READ_WRITE_TOKEN;
        
        vi.mocked(prisma.document.findUnique).mockResolvedValueOnce(null);

        await expect(DocumentService.verifyAndPersistPrivateUpload({
            storagePathname: 'private-documents/org-1/uuid-1',
            originalFilename: 'test.txt',
            clientLEId: 'le-123',
            uploadedById: 'user-123'
        })).rejects.toThrow("CRITICAL: PRIVATE_BLOB_READ_WRITE_TOKEN is missing");
    });

    it('should be idempotent and safely handle duplicate callbacks sequentially', async () => {
        vi.mocked(prisma.document.findUnique).mockResolvedValueOnce({ 
            id: 'existing-doc',
            clientLEId: 'le-123',
            uploadedById: 'user-123',
            storageProvider: 'VERCEL_BLOB',
            storagePathname: 'private-documents/org-1/uuid-already-processed'
        } as any);

        const doc = await DocumentService.verifyAndPersistPrivateUpload({
            storagePathname: 'private-documents/org-1/uuid-already-processed',
            originalFilename: 'test.txt',
            clientLEId: 'le-123',
            uploadedById: 'user-123'
        });

        expect(doc).toEqual({ id: 'existing-doc' });
        expect(get).not.toHaveBeenCalled();
        expect(del).not.toHaveBeenCalled();
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should handle a concurrent race safely (Unique constraint failed)', async () => {
        vi.mocked(prisma.document.findUnique).mockResolvedValueOnce(null);

        const mockBuffer = Buffer.from('test document content');
        vi.mocked(get).mockResolvedValueOnce({
            stream: createMockStream(mockBuffer) as any,
            contentType: 'text/plain',
            blob: {} as any,
            headers: new Headers(),
            url: '...',
            pathname: '...',
            size: 0,
            uploadedAt: new Date(),
            contentDisposition: '...'
        });

        // Simulate a Prisma P2002 Unique Constraint error
        const p2002Error = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: 'P2002', clientVersion: '6.x' });
        vi.mocked(prisma.$transaction).mockRejectedValueOnce(p2002Error);
        vi.mocked(prisma.document.findUnique).mockResolvedValueOnce({ 
            id: 'winning-doc',
            clientLEId: 'le-123',
            uploadedById: 'user-123',
            storageProvider: 'VERCEL_BLOB',
            storagePathname: 'private-documents/org-1/uuid-race'
        } as any);

        const doc = await DocumentService.verifyAndPersistPrivateUpload({
            storagePathname: 'private-documents/org-1/uuid-race',
            originalFilename: 'test.txt',
            clientLEId: 'le-123',
            uploadedById: 'user-123'
        });

        expect(doc).toEqual({ id: 'winning-doc' });
        
        // Critical: it must NOT have attempted to delete the blob because the blob is owned by the winning doc
        expect(del).not.toHaveBeenCalled();
    });

    it('should verify and persist a private upload successfully incrementally', async () => {
        vi.mocked(prisma.document.findUnique).mockResolvedValueOnce(null);

        // We use a large buffer to test streaming
        const chunk1 = Buffer.from('chunk1_');
        const chunk2 = Buffer.from('chunk2');
        const completeBuffer = Buffer.concat([chunk1, chunk2]);
        
        vi.mocked(get).mockResolvedValueOnce({
            stream: createMockStream(completeBuffer) as any,
            contentType: 'text/plain',
            blob: {} as any,
            headers: new Headers(),
            url: '...',
            pathname: '...',
            size: 0,
            uploadedAt: new Date(),
            contentDisposition: '...'
        });

        const doc = await DocumentService.verifyAndPersistPrivateUpload({
            storagePathname: 'private-documents/org-1/uuid-success',
            originalFilename: 'test.txt',
            clientLEId: 'le-123',
            uploadedById: 'user-123'
        });

        expect(get).toHaveBeenCalledWith('private-documents/org-1/uuid-success', { token: 'valid_token', access: 'private' });
        expect(doc).toEqual({ id: 'doc-123' });
        expect(prisma.$transaction).toHaveBeenCalled();
        expect(del).not.toHaveBeenCalled();
    });

    it('should attempt compensating cleanup if DB insert fails genuinely (not a race)', async () => {
        vi.mocked(prisma.document.findUnique).mockResolvedValueOnce(null);

        const mockBuffer = Buffer.from('test document content');
        vi.mocked(get).mockResolvedValueOnce({
            stream: createMockStream(mockBuffer) as any,
            contentType: 'text/plain',
            blob: {} as any,
            headers: new Headers(),
            url: '...',
            pathname: '...',
            size: 0,
            uploadedAt: new Date(),
            contentDisposition: '...'
        });

        // Simulate a genuine DB error (e.g. timeout)
        vi.mocked(prisma.$transaction).mockRejectedValueOnce(new Error('Connection timeout'));

        await expect(DocumentService.verifyAndPersistPrivateUpload({
            storagePathname: 'private-documents/org-1/uuid-failure',
            originalFilename: 'test3.txt',
            clientLEId: 'le-123',
            uploadedById: 'user-123'
        })).rejects.toThrow("Upload verification failed: Connection timeout");

        // del MUST be called because DB failed and it wasn't a race condition
        expect(del).toHaveBeenCalledWith('private-documents/org-1/uuid-failure', { token: 'valid_token' });
    });

    it('should log compensation failure without masking the original failure', async () => {
        vi.mocked(prisma.document.findUnique).mockResolvedValueOnce(null);

        const mockBuffer = Buffer.from('test');
        vi.mocked(get).mockResolvedValueOnce({
            stream: createMockStream(mockBuffer) as any,
            contentType: 'text/plain',
            blob: {} as any,
            headers: new Headers(),
            url: '...',
            pathname: '...',
            size: 0,
            uploadedAt: new Date(),
            contentDisposition: '...'
        });

        // Original error
        vi.mocked(prisma.$transaction).mockRejectedValueOnce(new Error('Original DB Error'));
        // Compensation error
        vi.mocked(del).mockRejectedValueOnce(new Error('Compensation Network Error'));

        // The original error should still propagate up
        await expect(DocumentService.verifyAndPersistPrivateUpload({
            storagePathname: 'private-documents/org-1/uuid-double-fault',
            originalFilename: 'test4.txt',
            clientLEId: 'le-123',
            uploadedById: 'user-123'
        })).rejects.toThrow("Upload verification failed: Original DB Error");
    });
});
