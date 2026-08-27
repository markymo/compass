/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { ClientLETeamAccess } from '../client-le-team-access';
import { getClientLETeamAssignments, saveClientLEPermissions } from '@/actions/client-le-team';
import { inviteUser, resendInvitation, revokeInvitation } from '@/actions/invitations';

const mockRefresh = vi.fn();
vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh: mockRefresh })
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockToastInfo = vi.fn();
vi.mock('sonner', () => ({
    toast: {
        success: (...args: any[]) => mockToastSuccess(...args),
        error: (...args: any[]) => mockToastError(...args),
        info: (...args: any[]) => mockToastInfo(...args)
    }
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

describe('ClientLETeamAccess UI Component Tests', () => {
    const mockMembers = [
        {
            userId: 'user-admin-1',
            email: 'admin@acme.com',
            name: 'Alice Admin',
            orgRole: 'Org Admin',
            leRole: 'NONE' as const,
            isCurrentUser: true
        },
        {
            userId: 'user-bob-2',
            email: 'bob@acme.com',
            name: 'Bob Worker',
            orgRole: 'Org Member',
            leRole: 'LE_USER' as const,
            isCurrentUser: false
        },
        {
            userId: 'user-charlie-3',
            email: 'charlie@acme.com',
            name: 'Charlie Manager',
            orgRole: 'Org Member',
            leRole: 'LE_ADMIN' as const,
            isCurrentUser: false
        },
        {
            userId: 'invite-inv-99',
            email: 'pending-david@acme.com',
            name: null,
            orgRole: 'Invited',
            leRole: 'LE_USER' as const,
            isCurrentUser: false,
            isPendingInvite: true,
            invitationId: 'inv-99'
        }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getClientLETeamAssignments).mockResolvedValue({
            success: true,
            currentUserId: 'user-admin-1',
            members: [...mockMembers]
        });
        vi.mocked(saveClientLEPermissions).mockResolvedValue({ success: true });
        vi.mocked(resendInvitation).mockResolvedValue({ success: true });
        vi.mocked(revokeInvitation).mockResolvedValue({ success: true });
        vi.mocked(inviteUser).mockResolvedValue({ success: true, message: 'Invitation sent' });
    });

    afterEach(() => {
        cleanup();
    });

    it('1. Renders current logged-in user first with appropriate badge in creation vs management mode', async () => {
        // Creation Mode
        const { unmount } = render(
            <ClientLETeamAccess
                clientLEId="cle-100"
                clientLEName="Acme Operations Ltd"
                orgId="org-1"
                isInitialSetup={true}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('admin@acme.com')).toBeDefined();
        });

        // Creation mode shows "You created this LE"
        expect(screen.getByText('You created this LE')).toBeDefined();
        unmount();
        cleanup();

        // Management Mode
        render(
            <ClientLETeamAccess
                clientLEId="cle-100"
                clientLEName="Acme Operations Ltd"
                orgId="org-1"
                isInitialSetup={false}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('admin@acme.com')).toBeDefined();
        });

        // Management mode shows compact "You"
        expect(screen.getByText('You')).toBeDefined();
        expect(screen.queryByText('You created this LE')).toBeNull();
    });

    it('2. Renders clear ClientLE-only scope messaging', async () => {
        render(
            <ClientLETeamAccess
                clientLEId="cle-100"
                clientLEName="Acme Operations Ltd"
                orgId="org-1"
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Access to this Legal Entity only.')).toBeDefined();
        });

        expect(screen.getByText(/Changes here do not affect organisation roles or access to other Legal Entities/i)).toBeDefined();
    });

    it('3. Renders programmatic aria-pressed state for role choices (None | User | Admin)', async () => {
        render(
            <ClientLETeamAccess
                clientLEId="cle-100"
                clientLEName="Acme Operations Ltd"
                orgId="org-1"
            />
        );

        await waitFor(() => {
            expect(screen.getByText('bob@acme.com')).toBeDefined();
        });

        // Bob has LE_USER -> User button has aria-pressed="true"
        const bobUserBtn = screen.getByRole('button', { name: 'Set bob@acme.com access to User' });
        const bobAdminBtn = screen.getByRole('button', { name: 'Set bob@acme.com access to Admin' });
        const bobNoneBtn = screen.getByRole('button', { name: 'Set bob@acme.com access to None' });

        expect(bobUserBtn.getAttribute('aria-pressed')).toBe('true');
        expect(bobAdminBtn.getAttribute('aria-pressed')).toBe('false');
        expect(bobNoneBtn.getAttribute('aria-pressed')).toBe('false');

        // Charlie has LE_ADMIN -> Admin button has aria-pressed="true"
        const charlieAdminBtn = screen.getByRole('button', { name: 'Set charlie@acme.com access to Admin' });
        expect(charlieAdminBtn.getAttribute('aria-pressed')).toBe('true');
    });

    it('4. Updates local role selections and saves assignments when Finish setup is clicked', async () => {
        render(
            <ClientLETeamAccess
                clientLEId="cle-100"
                clientLEName="Acme Operations Ltd"
                orgId="org-1"
                isInitialSetup={true}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('admin@acme.com')).toBeDefined();
        });

        // Toggle Alice from None -> Admin
        const aliceAdminBtn = screen.getByRole('button', { name: 'Set admin@acme.com access to Admin' });
        fireEvent.click(aliceAdminBtn);
        expect(aliceAdminBtn.getAttribute('aria-pressed')).toBe('true');

        // Click Finish setup
        const finishBtn = screen.getByRole('button', { name: 'Finish setup' });
        fireEvent.click(finishBtn);

        await waitFor(() => {
            expect(saveClientLEPermissions).toHaveBeenCalledWith({
                clientLEId: 'cle-100',
                orgId: 'org-1',
                assignments: expect.arrayContaining([
                    { userId: 'user-admin-1', role: 'LE_ADMIN' }
                ])
            });
        });
    });

    it('5. Renders pending invitation rows with Invited badge, Resend, and Revoke buttons', async () => {
        render(
            <ClientLETeamAccess
                clientLEId="cle-100"
                clientLEName="Acme Operations Ltd"
                orgId="org-1"
            />
        );

        await waitFor(() => {
            expect(screen.getByText('pending-david@acme.com')).toBeDefined();
        });

        expect(screen.getByText('Invited (User)')).toBeDefined();

        const resendBtn = screen.getByRole('button', { name: 'Resend invitation to pending-david@acme.com' });
        const revokeBtn = screen.getByRole('button', { name: 'Revoke invitation for pending-david@acme.com' });

        expect(resendBtn).toBeDefined();
        expect(revokeBtn).toBeDefined();

        // Resend click
        fireEvent.click(resendBtn);
        await waitFor(() => {
            expect(resendInvitation).toHaveBeenCalledWith('inv-99');
            expect(mockToastSuccess).toHaveBeenCalledWith('Invitation resent to pending-david@acme.com');
        });

        // Revoke click
        fireEvent.click(revokeBtn);
        await waitFor(() => {
            expect(revokeInvitation).toHaveBeenCalledWith('inv-99');
            expect(mockToastSuccess).toHaveBeenCalledWith('Invitation revoked for pending-david@acme.com');
        });
    });

    it('6. Add someone form expands, handles email submission, and surfaces duplicate invite error', async () => {
        render(
            <ClientLETeamAccess
                clientLEId="cle-100"
                clientLEName="Acme Operations Ltd"
                orgId="org-1"
            />
        );

        await waitFor(() => {
            expect(screen.getByText('admin@acme.com')).toBeDefined();
        });

        // Initially collapsed
        expect(screen.queryByPlaceholderText('colleague@example.com')).toBeNull();

        // Expand form
        const addBtn = screen.getByRole('button', { name: /\+ Add someone/i });
        fireEvent.click(addBtn);

        const emailInput = screen.getByPlaceholderText('colleague@example.com');
        expect(emailInput).toBeDefined();

        // Submit invalid email format
        fireEvent.change(emailInput, { target: { value: 'invalid-email-format' } });
        const submitAddBtn = screen.getByRole('button', { name: 'Add' });
        fireEvent.click(submitAddBtn);

        expect(screen.getByText('Please enter a valid email address.')).toBeDefined();
        expect(inviteUser).not.toHaveBeenCalled();

        // Submit duplicate email
        fireEvent.change(emailInput, { target: { value: 'pending-david@acme.com' } });
        fireEvent.click(submitAddBtn);

        expect(screen.getByText('An invitation is already pending for pending-david@acme.com')).toBeDefined();
        expect(inviteUser).not.toHaveBeenCalled();

        // Submit new email
        fireEvent.change(emailInput, { target: { value: 'new-member@acme.com' } });
        fireEvent.click(submitAddBtn);

        await waitFor(() => {
            expect(inviteUser).toHaveBeenCalledWith({
                email: 'new-member@acme.com',
                role: 'LE_USER',
                clientLEId: 'cle-100'
            });
        });
    });
});
