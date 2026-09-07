/**
 * @vitest-environment happy-dom
 */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { ClientLETable } from '../ClientLETable';
import { AdminClientLEItem } from '@/types/admin-client-le';

vi.mock('@/actions/admin', () => ({
    restoreClientLEFromAdmin: vi.fn(),
}));

describe('ClientLETable Component Rendering Regression Tests', () => {
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    const deletedItem: AdminClientLEItem = {
        id: 'le-deleted-1',
        name: 'Deleted Alpha Corp',
        shortCode: 'DAC',
        jurisdiction: 'GB',
        lei: '1234567890ABCDEFGHIJ',
        status: 'ACTIVE', // Persisted DB status is ACTIVE
        isDeleted: true,  // Soft-deleted
        createdAt: '2026-01-01T00:00:00.000Z',
        parentOrgs: [{ id: 'org-1', name: 'Parent Group', shortCode: 'PG' }],
        engagementCount: 2,
        memberCount: 5,
    };

    const activeItem: AdminClientLEItem = {
        id: 'le-active-1',
        name: 'Active Beta Corp',
        shortCode: 'ABC',
        jurisdiction: 'US',
        lei: '0987654321ZYXWVUTSRQ',
        status: 'ACTIVE',
        isDeleted: false,
        createdAt: '2026-02-01T00:00:00.000Z',
        parentOrgs: [],
        engagementCount: 1,
        memberCount: 3,
    };

    it('renders DELETED status and Restore button for a soft-deleted ClientLE (status: ACTIVE, isDeleted: true)', () => {
        render(<ClientLETable les={[deletedItem]} />);

        // Status badge must show DELETED, not ACTIVE
        expect(screen.getByText('DELETED')).toBeInTheDocument();
        expect(screen.queryByText('ACTIVE')).not.toBeInTheDocument();

        // Must show Restore button
        expect(screen.getByRole('button', { name: /restore/i })).toBeInTheDocument();
        expect(screen.queryByText(/manage le/i)).not.toBeInTheDocument();

        // Verify jurisdiction and LEI
        expect(screen.getByText('GB')).toBeInTheDocument();
        expect(screen.getByText('1234567890ABCDEFGHIJ')).toBeInTheDocument();
    });

    it('renders ACTIVE status and displays ClientLE name without operational links (status: ACTIVE, isDeleted: false)', () => {
        render(<ClientLETable les={[activeItem]} />);

        // Status badge must show ACTIVE
        expect(screen.getByText('ACTIVE')).toBeInTheDocument();
        expect(screen.queryByText('DELETED')).not.toBeInTheDocument();

        // Name is rendered as text, not a link to operational dossier
        expect(screen.getByText('Active Beta Corp')).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /active beta corp/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /manage le/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /restore/i })).not.toBeInTheDocument();
    });
});
