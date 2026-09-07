import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateDocumentFile, ALLOWED_MIME_TYPES } from '../upload-constants';
import { DocumentLibraryService } from '../DocumentLibraryService';
import prisma from '@/lib/prisma';

// Contract: FILE-01 — User Files upload lifecycle works
// Linear: ONP-26

vi.mock('@/lib/prisma', () => ({
    default: {
        document: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
            create: vi.fn()
        },
        fieldClaim: {
            findMany: vi.fn().mockResolvedValue([])
        },
        cCPartyDocument: {
            findMany: vi.fn().mockResolvedValue([])
        },
        cCParty: {
            findMany: vi.fn().mockResolvedValue([])
        },
        uploadIntent: {
            findUnique: vi.fn(),
            create: vi.fn(),
            update: vi.fn()
        }
    }
}));

describe('FILE-01 / ONP-26 — User Files Invariants', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('1. Validates allowed mime types correctly', () => {
        const validPdf = new File(['dummy'], 'test.pdf', { type: 'application/pdf' });
        const invalidExe = new File(['dummy'], 'test.exe', { type: 'application/x-msdownload' });

        expect(validateDocumentFile(validPdf)).toBeNull();
        expect(validateDocumentFile(invalidExe)).toContain('not supported');
    });

    it('2. Rejects files exceeding max size limit', () => {
        const largeContent = new Uint8Array(25 * 1024 * 1024); // 25MB
        const largeFile = new File([largeContent], 'large.pdf', { type: 'application/pdf' });

        const result = validateDocumentFile(largeFile);
        expect(result).toContain('exceeds the 20MB limit');
    });

    it('3. DocumentLibraryService lists documents for ClientLE accurately', async () => {
        (prisma.document.findMany as any).mockResolvedValue([
            {
                id: 'doc-1',
                clientLEId: 'cle-1',
                name: 'passport.pdf',
                mimeType: 'application/pdf',
                sizeBytes: BigInt(1024),
                storageUrl: 'https://blob.vercel-storage.com/passport.pdf',
                createdAt: new Date(),
                updatedAt: new Date()
            }
        ]);

        const result = await DocumentLibraryService.listLibraryDocuments('cle-1');

        expect(result).toHaveLength(1);
        expect(result[0].filename).toBe('passport.pdf');
        expect(result[0].status).toBe('UNUSED');
    });
});
