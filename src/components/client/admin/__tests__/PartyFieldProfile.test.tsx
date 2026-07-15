/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { FieldDetailSheet } from '../field-detail-sheet';
import * as governanceActions from '@/actions/master-data-governance';
import { toast } from 'sonner';

// Mock actions and toast
vi.mock('@/actions/master-data-governance', () => ({
    updateMasterField: vi.fn(),
    checkCustomFieldDependencies: vi.fn(),
    softDeleteCustomField: vi.fn()
}));
vi.mock('@/actions/master-data-option-sets', () => ({
    getOptionSets: vi.fn().mockResolvedValue({ success: true, optionSets: [] })
}));
vi.mock('@/actions/user-preferences', () => ({
    getEffectiveMappingDefaults: vi.fn().mockResolvedValue({})
}));
vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh: vi.fn() })
}));
vi.mock('sonner', () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn()
    }
}));
vi.mock('next-auth', () => ({
    default: vi.fn(() => ({
        handlers: {},
        auth: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn()
    })),
    getServerSession: vi.fn().mockResolvedValue(null),
    useSession: vi.fn().mockReturnValue({ data: null, status: 'unauthenticated' })
}));

describe('Party Field Profile Simplification', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        cleanup();
    });

    const renderSheet = (profileConfig: any = null) => {
        return render(<FieldDetailSheet field={{ fieldNo: 99, fieldName: 'Test Party', appDataType: 'PARTY', profileConfig }} open={true} onOpenChange={vi.fn()} categories={[]} />);
    };

    it('loads an unrestricted PARTY field (empty config) with all 3 checkboxes checked', async () => {
        renderSheet();
        
        // Open the Profile section
        fireEvent.click(screen.getAllByText('PARTY Field Profile')[0]);
        
        const indCheckbox = screen.getByLabelText('Individual');
        const teamCheckbox = screen.getByLabelText('Team');
        const orgCheckbox = screen.getByLabelText('Organisation');
        
        expect(indCheckbox.getAttribute('data-state')).toBe('checked');
        expect(teamCheckbox.getAttribute('data-state')).toBe('checked');
        expect(orgCheckbox.getAttribute('data-state')).toBe('checked');
    });

    it('loads existing fields properly (Individual only, like Field 63)', async () => {
        renderSheet({ allowedPartyTypes: ['INDIVIDUAL'], allowedPartySubTypes: ['PERSON'] });
        
        fireEvent.click(screen.getAllByText('PARTY Field Profile')[0]);
        
        expect(screen.getByLabelText('Individual').getAttribute('data-state')).toBe('checked');
        expect(screen.getByLabelText('Team').getAttribute('data-state')).toBe('unchecked');
        expect(screen.getByLabelText('Organisation').getAttribute('data-state')).toBe('unchecked');
    });

    it('historic subtype TEAM does not select the Team checkbox but remains preserved', async () => {
        renderSheet({ allowedPartyTypes: ['ORGANISATION'], allowedPartySubTypes: ['TEAM', 'DISTRIBUTION_LIST'] });
        
        fireEvent.click(screen.getAllByText('PARTY Field Profile')[0]);
        
        expect(screen.getByLabelText('Individual').getAttribute('data-state')).toBe('unchecked');
        // Historic subtype is ignored; Team checkbox relies solely on allowedPartyTypes
        expect(screen.getByLabelText('Team').getAttribute('data-state')).toBe('unchecked');
        expect(screen.getByLabelText('Organisation').getAttribute('data-state')).toBe('checked');
    });

    it('unchecking Team remains unselected after save and reload, preserving historic subtypes inertly', async () => {
        (governanceActions.updateMasterField as any).mockResolvedValue({ success: true });
        
        // Start with TEAM in types and subtypes
        renderSheet({ allowedPartyTypes: ['ORGANISATION', 'TEAM'], allowedPartySubTypes: ['TEAM'] });
        fireEvent.click(screen.getAllByText('PARTY Field Profile')[0]);
        
        // Uncheck Team
        fireEvent.click(screen.getByLabelText('Team'));
        
        const saveBtn = screen.getByRole('button', { name: /Save & Close/i });
        fireEvent.click(saveBtn);
        
        await waitFor(() => {
            expect(governanceActions.updateMasterField).toHaveBeenCalledWith(99, expect.objectContaining({
                profileConfig: expect.objectContaining({
                    allowedPartyTypes: ['ORGANISATION'],
                    allowedPartySubTypes: ['TEAM'] // preserved but inert
                })
            }));
        });
    });

    it('saves mixed selections correctly and preserves dormant subtypes', async () => {
        (governanceActions.updateMasterField as any).mockResolvedValue({ success: true });
        
        // Start with historic unrestricted
        renderSheet({ allowedPartyTypes: [], allowedPartySubTypes: ['PERSON'] });
        fireEvent.click(screen.getAllByText('PARTY Field Profile')[0]);
        
        // Uncheck Organisation
        fireEvent.click(screen.getByLabelText('Organisation'));
        
        const saveBtn = screen.getByRole('button', { name: /Save & Close/i });
        fireEvent.click(saveBtn);
        
        await waitFor(() => {
            expect(governanceActions.updateMasterField).toHaveBeenCalledWith(99, expect.objectContaining({
                profileConfig: expect.objectContaining({
                    allowedPartyTypes: ['INDIVIDUAL', 'TEAM'],
                    allowedPartySubTypes: ['PERSON'] // preserved
                })
            }));
        });
    });

    it('prevents saving if all three checkboxes are cleared (invalid empty selection)', async () => {
        (governanceActions.updateMasterField as any).mockResolvedValue({ success: true });
        
        renderSheet({ allowedPartyTypes: ['INDIVIDUAL'] });
        fireEvent.click(screen.getAllByText('PARTY Field Profile')[0]);
        
        // Uncheck the only checked one
        fireEvent.click(screen.getByLabelText('Individual'));
        
        const saveBtn = screen.getByRole('button', { name: /Save & Close/i });
        fireEvent.click(saveBtn);
        
        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith('A PARTY field must allow at least one Party type.');
            expect(governanceActions.updateMasterField).not.toHaveBeenCalled();
        });
    });

    it('saves unrestricted correctly (omits allowedPartyTypes) when all 3 are checked', async () => {
        (governanceActions.updateMasterField as any).mockResolvedValue({ success: true });
        
        renderSheet({ allowedPartyTypes: ['INDIVIDUAL', 'TEAM'] });
        fireEvent.click(screen.getAllByText('PARTY Field Profile')[0]);
        
        // Check the third one
        fireEvent.click(screen.getByLabelText('Organisation'));
        
        const saveBtn = screen.getByRole('button', { name: /Save & Close/i });
        fireEvent.click(saveBtn);
        
        await waitFor(() => {
            const updateCall = (governanceActions.updateMasterField as any).mock.calls[0][1];
            expect(updateCall.profileConfig.allowedPartyTypes).toBeUndefined();
        });
    });

    it('collapses Party Value Source and displays its summary correctly', async () => {
        renderSheet({ partyPopulationPolicy: 'CURATED_ONLY' });
        fireEvent.click(screen.getAllByText('PARTY Field Profile')[0]);
        
        // The sub-section label
        const sourceLabel = screen.getByText('Party value source');
        expect(sourceLabel).toBeDefined();
        
        // It defaults to expanded, so the content should be visible
        const option = screen.getByText('Curated only');
        expect(option).toBeDefined();

        // Click to collapse
        fireEvent.click(sourceLabel);
        
        // Wait for it to show the summary badge when collapsed
        await waitFor(() => {
            expect(screen.getByText('Curated only', { selector: 'span.bg-slate-100' })).toBeDefined();
        });
    });

    it('leaves Display Mask unchanged', async () => {
        renderSheet({ allowedPartyTypes: ['INDIVIDUAL'], displayMask: ['forenames', 'surname'] });
        fireEvent.click(screen.getAllByText('PARTY Field Profile')[0]);
        
        const saveBtn = screen.getByRole('button', { name: /Save & Close/i });
        fireEvent.click(saveBtn);
        
        await waitFor(() => {
            expect(governanceActions.updateMasterField).toHaveBeenCalledWith(99, expect.objectContaining({
                profileConfig: expect.objectContaining({
                    displayMask: ['forenames', 'surname']
                })
            }));
        });
    });

});
