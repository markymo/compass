import { describe, it, expect, vi } from 'vitest';
import { canUserDownloadDocument } from '../document-download-auth';
import prisma from '@/lib/prisma';

// Contract: DOC-01 — A relationship document that the user is entitled to see is visible and directly openable/downloadable as an individual file
// Linear: ONP-29, ONP-64

vi.mock('@/lib/prisma', () => ({
    default: {
        document: {
            findUnique: vi.fn(),
        },
        membership: {
            findMany: vi.fn(),
        },
    },
}));

vi.mock('@/lib/auth/permissions', () => ({
    can: vi.fn().mockImplementation(async (user, action, context) => {
        if (context?.clientLEId === 'client_le_alpha_123') return true;
        return false;
    }),
    Action: {
        LE_VIEW_MASTER_DATA: 'LE_VIEW_MASTER_DATA',
    },
}));

describe('DOC-01 / ONP-29 + ONP-64 — Document Entitlement & Direct Download Authorization', () => {
    it('allows Client LE Admin to download document belonging to their ClientLE', async () => {
        (prisma.document.findUnique as any).mockResolvedValue({
            id: 'doc_123',
            name: 'Certificate_of_Incorporation.pdf',
            clientLEId: 'client_le_alpha_123',
            storageProvider: 'VERCEL_BLOB',
            storagePathname: 'documents/cert.pdf',
            isDeleted: false,
        });

        (prisma.membership.findMany as any).mockResolvedValue([
            {
                organizationId: 'org_1',
                clientLEId: 'client_le_alpha_123',
                role: 'LE_ADMIN',
                organization: { types: ['CLIENT'] },
            }
        ]);

        const result = await canUserDownloadDocument('user_alpha_admin', 'doc_123');
        expect(result.allowed).toBe(true);
        expect(result.status).toBe(200);
        expect(result.document?.name).toBe('Certificate_of_Incorporation.pdf');
    });

    it('rejects unauthorized access when document belongs to a different ClientLE', async () => {
        (prisma.document.findUnique as any).mockResolvedValue({
            id: 'doc_unauthorized',
            name: 'Secret_Doc.pdf',
            clientLEId: 'client_le_other_999',
            storageProvider: 'VERCEL_BLOB',
            storagePathname: 'documents/secret.pdf',
            isDeleted: false,
        });

        (prisma.membership.findMany as any).mockResolvedValue([
            {
                organizationId: 'org_1',
                clientLEId: 'client_le_alpha_123',
                role: 'LE_ADMIN',
                organization: { types: ['CLIENT'] },
            }
        ]);

        const result = await canUserDownloadDocument('user_alpha_admin', 'doc_unauthorized');
        expect(result.allowed).toBe(false);
        expect(result.status).toBe(403);
    });
});
