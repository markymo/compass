import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock system admin check
vi.mock('../admin', () => ({
    isSystemAdmin: vi.fn().mockResolvedValue(true),
}));

// Mock revalidatePath
vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}));

const mockOrgFindMany = vi.fn();
const mockOrgFindUnique = vi.fn();
const mockOrgCreate = vi.fn();

vi.mock('@/lib/prisma', () => ({
    default: {
        organization: {
            findMany: (...args: any[]) => mockOrgFindMany(...args),
            findUnique: (...args: any[]) => mockOrgFindUnique(...args),
            create: (...args: any[]) => mockOrgCreate(...args),
        },
    },
}));

import { createOrganization } from '../org';

describe('createOrganization action', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('automatically generates a 5-character shortcode and normalizes domain upon creation', async () => {
        mockOrgFindMany.mockResolvedValue([]);
        mockOrgCreate.mockImplementation(({ data }) => Promise.resolve({ id: 'org-1', ...data }));

        const res = await createOrganization('Acme Global Services', ['CLIENT'], '  HTTPS://AcmeGlobal.com/ ');

        expect(res.success).toBe(true);
        expect(mockOrgCreate).toHaveBeenCalledWith({
            data: {
                name: 'Acme Global Services',
                types: ['CLIENT'],
                domain: 'acmeglobal.com',
                shortCode: 'ACME0',
            },
        });
    });

    it('resolves shortcode collisions automatically while preserving 5-character length limit', async () => {
        // Suppose 'ACME0' already exists in the database (active or archived)
        mockOrgFindMany.mockResolvedValue([{ shortCode: 'ACME0' }]);
        mockOrgCreate.mockImplementation(({ data }) => Promise.resolve({ id: 'org-2', ...data }));

        const res = await createOrganization('Acme Global Services', ['CLIENT']);

        expect(res.success).toBe(true);
        expect(res.data?.shortCode).toBe('ACME1');
        expect(res.data?.shortCode).toHaveLength(5);
    });

    it('treats soft-deleted (archived) Organizations as reserving their shortcode', async () => {
        // DB findMany includes all rows (active and archived)
        mockOrgFindMany.mockResolvedValue([
            { shortCode: 'ACME0' }, // Archived org
            { shortCode: 'ACME1' }, // Active org
        ]);
        mockOrgCreate.mockImplementation(({ data }) => Promise.resolve({ id: 'org-3', ...data }));

        const res = await createOrganization('Acme Global Services', ['CLIENT']);

        expect(res.success).toBe(true);
        expect(res.data?.shortCode).toBe('ACME2');
    });

    it('preserves a manually supplied unique shortcode', async () => {
        mockOrgFindUnique.mockResolvedValue(null);
        mockOrgCreate.mockImplementation(({ data }) => Promise.resolve({ id: 'org-4', ...data }));

        const res = await createOrganization('Custom Org', ['CLIENT'], 'custom.com', 'MYCOD');

        expect(res.success).toBe(true);
        expect(res.data?.shortCode).toBe('MYCOD');
        expect(mockOrgCreate).toHaveBeenCalledWith({
            data: {
                name: 'Custom Org',
                types: ['CLIENT'],
                domain: 'custom.com',
                shortCode: 'MYCOD',
            },
        });
    });

    it('returns a clear error when a manually supplied shortcode is already in use', async () => {
        mockOrgFindUnique.mockResolvedValue({ id: 'existing-org-id', shortCode: 'TAKN1' });

        const res = await createOrganization('Custom Org', ['CLIENT'], undefined, 'TAKN1');

        expect(res.success).toBe(false);
        expect(res.error).toBe('Short code already in use.');
        expect(mockOrgCreate).not.toHaveBeenCalled();
    });
});
