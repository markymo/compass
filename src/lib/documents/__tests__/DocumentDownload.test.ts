import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/documents/[id]/download/route';
import { get } from '@vercel/blob';
import prisma from '@/lib/prisma';
import { ensureApiAuthorization } from '@/lib/auth/api-auth';
import { Readable } from 'stream';

// Mock Dependencies
vi.mock('@vercel/blob', () => ({
    get: vi.fn()
}));

vi.mock('@/lib/prisma', () => ({
    default: {
        document: {
            findUnique: vi.fn()
        }
    }
}));

vi.mock('@/lib/auth/api-auth', () => ({
    ensureApiAuthorization: vi.fn()
}));

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

describe('Download API Route', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.clearAllMocks();
        process.env = { ...originalEnv, PRIVATE_BLOB_READ_WRITE_TOKEN: 'valid_token' };
    });

    it('should return 404 if document is not found', async () => {
        vi.mocked(prisma.document.findUnique).mockResolvedValueOnce(null);
        
        const response = await GET({} as Request, { params: { id: 'invalid-id' } });
        expect(response.status).toBe(404);
    });

    it('should return 403 if user lacks authorization', async () => {
        vi.mocked(prisma.document.findUnique).mockResolvedValueOnce({
            id: 'doc-1',
            clientLEId: 'org-1'
        } as any);

        vi.mocked(ensureApiAuthorization).mockRejectedValueOnce(new Error('Unauthorized'));
        
        const response = await GET({} as Request, { params: { id: 'doc-1' } });
        expect(response.status).toBe(403);
    });

    it('should return 400 if document is not a private Vercel Blob', async () => {
        vi.mocked(prisma.document.findUnique).mockResolvedValueOnce({
            id: 'doc-1',
            clientLEId: 'org-1',
            storageProvider: null,
            fileUrl: null
        } as any);

        vi.mocked(ensureApiAuthorization).mockResolvedValueOnce({ userId: 'u-1', user: {} as any });
        
        const response = await GET({} as Request, { params: { id: 'doc-1' } });
        expect(response.status).toBe(400);
    });

    it('should successfully proxy download with strict headers', async () => {
        vi.mocked(prisma.document.findUnique).mockResolvedValueOnce({
            id: 'doc-1',
            clientLEId: 'org-1',
            storageProvider: 'VERCEL_BLOB',
            storagePathname: 'private/doc-1',
            name: 'Report (Q1).pdf',
            mimeType: 'application/pdf'
        } as any);

        vi.mocked(ensureApiAuthorization).mockResolvedValueOnce({ userId: 'u-1', user: {} as any });
        
        const mockBuffer = Buffer.from('pdf content');
        vi.mocked(get).mockResolvedValueOnce({
            stream: createMockStream(mockBuffer) as any,
            contentType: 'application/pdf',
            blob: {} as any,
            headers: new Headers(),
            url: '...',
            pathname: '...',
            size: 0,
            uploadedAt: new Date(),
            contentDisposition: '...'
        });

        const response = await GET({} as Request, { params: { id: 'doc-1' } });
        expect(response.status).toBe(200);

        // Verify Headers
        const headers = response.headers;
        expect(headers.get('Content-Type')).toBe('application/pdf');
        expect(headers.get('Content-Disposition')).toContain('attachment; filename*=UTF-8\'\'Report%20%28Q1%29.pdf');
        expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
        expect(headers.get('Cache-Control')).toBe('private, no-store');
    });
});
