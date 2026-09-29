// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import OrganizationsPage from '../page';
import { getOrganizations, checkOrgDeletable, deleteOrganization } from '@/actions/org';
import { ORGANIZATION_MEMBERSHIP_CHANGED } from '@/lib/organization-membership-events';

vi.mock('@/actions/org', () => ({
    getOrganizations: vi.fn(), checkOrgDeletable: vi.fn(), deleteOrganization: vi.fn(),
    createOrganization: vi.fn(), updateOrganization: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const org = (id: string, count: number) => ({ id, name: 'Nobina', shortCode: null, domain: null, types: ['CLIENT', 'SUPPLIER'], _count: { memberships: count } });
const row = (id: string) => document.querySelector(`[data-organization-id="${id}"]`) as HTMLElement;

beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getOrganizations).mockResolvedValue([org('org-a', 0), org('org-b', 0)] as any);
});
afterEach(cleanup);

describe('R01 organisation list', () => {
    it('distinguishes equal names without short codes/domains and preserves both roles', async () => {
        render(<OrganizationsPage />);
        await screen.findByText('ID: org-a');
        expect(screen.getByText('ID: org-b')).toBeTruthy();
        expect(within(row('org-a')).getByText('CLIENT')).toBeTruthy();
        expect(within(row('org-a')).getByText('SUPPLIER')).toBeTruthy();
    });

    it.each(['focus', 'pageshow', ORGANIZATION_MEMBERSHIP_CHANGED, 'storage', 'visibilitychange'])('refreshes held counts on %s', async event => {
        render(<OrganizationsPage />);
        await screen.findByText('ID: org-a');
        vi.mocked(getOrganizations).mockResolvedValue([org('org-a', 1), org('org-b', 0)] as any);
        await act(async () => {
            if (event === 'storage') window.dispatchEvent(new StorageEvent('storage', { key: ORGANIZATION_MEMBERSHIP_CHANGED }));
            else if (event === 'visibilitychange') {
                Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
                document.dispatchEvent(new Event(event));
            } else window.dispatchEvent(new Event(event));
        });
        await waitFor(() => expect(within(row('org-a')).getByText('1')).toBeTruthy());
        expect(within(row('org-b')).getByText('0')).toBeTruthy();
    });

    it('does not let an older request overwrite a newer count', async () => {
        render(<OrganizationsPage />);
        await screen.findByText('ID: org-a');
        let resolveOld!: (value: any) => void;
        vi.mocked(getOrganizations).mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
        fireEvent.focus(window);
        vi.mocked(getOrganizations).mockResolvedValue([org('org-a', 1)] as any);
        await act(async () => window.dispatchEvent(new Event(ORGANIZATION_MEMBERSHIP_CHANGED)));
        await waitFor(() => expect(within(row('org-a')).getByText('1')).toBeTruthy());
        await act(async () => resolveOld([org('org-a', 0)]));
        expect(within(row('org-a')).getByText('1')).toBeTruthy();
    });

    it('refreshes a stale zero when the fresh deletion check blocks and never deletes', async () => {
        render(<OrganizationsPage />);
        await screen.findByText('ID: org-a');
        vi.mocked(checkOrgDeletable).mockResolvedValue({ deletable: false, error: 'Cannot delete: org has 1 member', blockers: ['1 member'] });
        vi.mocked(getOrganizations).mockResolvedValue([org('org-a', 1), org('org-b', 0)] as any);
        fireEvent.click(row('org-a').querySelector('[title="Delete organization"] button')!);
        await screen.findByText('Cannot delete: org has 1 member');
        expect(within(row('org-a')).getByText('1')).toBeTruthy();
        expect(deleteOrganization).not.toHaveBeenCalled();
    });
});
