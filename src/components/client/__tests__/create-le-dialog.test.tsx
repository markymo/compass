/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { CreateLEDialog } from '../create-le-dialog';
import { createClientLE } from '@/actions/client';
import { getClientLETeamAssignments } from '@/actions/client-le-team';

const mockRefresh = vi.fn();
vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh: mockRefresh })
}));

vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn()
    }
}));

vi.mock('@/actions/client', () => ({
    createClientLE: vi.fn()
}));

vi.mock('@/actions/client-le-team', () => ({
    getClientLETeamAssignments: vi.fn(),
    saveClientLEPermissions: vi.fn()
}));

vi.mock('@/actions/invitations', () => ({
    inviteUser: vi.fn(),
    resendInvitation: vi.fn(),
    revokeInvitation: vi.fn()
}));

describe('CreateLEDialog 2-Step Creation & Access Component Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getClientLETeamAssignments).mockResolvedValue({
            success: true,
            currentUserId: 'user-admin-1',
            members: [
                {
                    userId: 'user-admin-1',
                    email: 'admin@acme.com',
                    name: 'Alice Admin',
                    orgRole: 'Org Admin',
                    leRole: 'NONE',
                    isCurrentUser: true
                }
            ]
        });
    });

    it('transitions from Step 1 creation form to Step 2 team access upon successful creation', async () => {
        vi.mocked(createClientLE).mockResolvedValue({
            success: true,
            data: {
                id: 'le-newly-created-555',
                name: 'Lynn Wind Farm Limited',
                jurisdiction: 'UK',
                status: 'ACTIVE'
            }
        });

        render(<CreateLEDialog orgId="org-1" />);

        // Open Dialog
        const triggerBtn = screen.getByRole('button', { name: 'Add Legal Entity' });
        fireEvent.click(triggerBtn);

        // Fill entity details
        const nameInput = screen.getByPlaceholderText('Acme Corp Ltd');
        const jurInput = screen.getByPlaceholderText('e.g. UK, Delaware, Singapore');

        fireEvent.change(nameInput, { target: { value: 'Lynn Wind Farm Limited' } });
        fireEvent.change(jurInput, { target: { value: 'UK' } });

        // Submit Step 1
        const createBtn = screen.getByRole('button', { name: 'Create Legal Entity' });
        fireEvent.click(createBtn);

        // Modal should NOT close; it should retain LE ID/name and transition to Step 2
        await waitFor(() => {
            expect(createClientLE).toHaveBeenCalledWith({
                name: 'Lynn Wind Farm Limited',
                jurisdiction: 'UK',
                explicitOrgId: 'org-1',
                lei: undefined,
                gleifData: undefined
            });
        });

        // Step 2 banner acknowledging creation
        await waitFor(() => {
            expect(screen.getByText('Lynn Wind Farm Limited created successfully')).toBeDefined();
        });

        // Retains newly created ClientLE ID when loading team members
        expect(getClientLETeamAssignments).toHaveBeenCalledWith('le-newly-created-555', 'org-1');
    });
});
