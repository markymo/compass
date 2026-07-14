/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FieldDetailSheet } from '../field-detail-sheet';
import { FieldCreateSheet } from '../field-create-sheet';
import * as governanceActions from '@/actions/master-data-governance';

// Mock actions and router
vi.mock('@/actions/master-data-governance', () => ({
    updateMasterField: vi.fn(),
    createMasterField: vi.fn(),
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

describe('Admin Field Settings - Allow file attachments', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('FieldDetailSheet (Edit existing field)', () => {
        it('shows Allow file attachments and loads the existing value (false)', async () => {
            render(<FieldDetailSheet field={{ fieldNo: 1, fieldName: 'Test', allowAttachments: false, appDataType: 'TEXT' }} open={true} onOpenChange={vi.fn()} categories={[]} />);
            
            const label = await screen.findByText('Allow file attachments');
            expect(label).toBeDefined();
            
            const switchEl = screen.getByRole('switch', { name: /Allow file attachments/i });
            expect(switchEl).toBeDefined();
            expect(switchEl.getAttribute('aria-checked')).toBe('false');
        });

        it('shows Allow file attachments and loads the existing value (true)', async () => {
            render(<FieldDetailSheet field={{ fieldNo: 1, fieldName: 'Test', allowAttachments: true, appDataType: 'TEXT' }} open={true} onOpenChange={vi.fn()} categories={[]} />);
            
            const switchEl = await screen.findByRole('switch', { name: /Allow file attachments/i });
            expect(switchEl.getAttribute('aria-checked')).toBe('true');
        });

        it('enabling persists true', async () => {
            (governanceActions.updateMasterField as any).mockResolvedValue({ success: true });
            
            render(<FieldDetailSheet field={{ fieldNo: 1, fieldName: 'Test', allowAttachments: false, appDataType: 'TEXT' }} open={true} onOpenChange={vi.fn()} categories={[]} />);
            
            const switchEl = await screen.findByRole('switch', { name: /Allow file attachments/i });
            fireEvent.click(switchEl);
            
            const saveBtn = screen.getByRole('button', { name: /Save & Close/i });
            fireEvent.click(saveBtn);
            
            await waitFor(() => {
                expect(governanceActions.updateMasterField).toHaveBeenCalledWith(1, expect.objectContaining({ allowAttachments: true }));
            });
        });

        it('disabling persists false', async () => {
            (governanceActions.updateMasterField as any).mockResolvedValue({ success: true });
            
            render(<FieldDetailSheet field={{ fieldNo: 1, fieldName: 'Test', allowAttachments: true, appDataType: 'TEXT' }} open={true} onOpenChange={vi.fn()} categories={[]} />);
            
            const switchEl = await screen.findByRole('switch', { name: /Allow file attachments/i });
            fireEvent.click(switchEl);
            
            const saveBtn = screen.getByRole('button', { name: /Save & Close/i });
            fireEvent.click(saveBtn);
            
            await waitFor(() => {
                expect(governanceActions.updateMasterField).toHaveBeenCalledWith(1, expect.objectContaining({ allowAttachments: false }));
            });
        });

        it('editing another field attribute does not reset the flag', async () => {
            (governanceActions.updateMasterField as any).mockResolvedValue({ success: true });
            
            render(<FieldDetailSheet field={{ fieldNo: 1, fieldName: 'Test', allowAttachments: true, appDataType: 'TEXT' }} open={true} onOpenChange={vi.fn()} categories={[]} />);
            
            const descInput = await screen.findByRole('textbox', { name: /Public Description/i });
            fireEvent.change(descInput, { target: { value: 'New desc' } });
            
            const saveBtn = screen.getByRole('button', { name: /Save & Close/i });
            fireEvent.click(saveBtn);
            
            await waitFor(() => {
                expect(governanceActions.updateMasterField).toHaveBeenCalledWith(1, expect.objectContaining({ allowAttachments: true, description: 'New desc' }));
            });
        });
    });

    describe('FieldCreateSheet (New field)', () => {
        it('new fields default to false', async () => {
            (governanceActions.createMasterField as any).mockResolvedValue({ success: true });
            
            render(<FieldCreateSheet open={true} onOpenChange={vi.fn()} categories={[]} />);
            
            const switchEl = await screen.findByRole('switch', { name: /Allow file attachments/i });
            expect(switchEl).toBeDefined();
            expect(switchEl.getAttribute('aria-checked')).toBe('false');

            const nameInput = screen.getByLabelText(/Field Name \*/i);
            fireEvent.change(nameInput, { target: { value: 'New Field' } });

            const saveBtn = screen.getByRole('button', { name: /Create Field/i });
            fireEvent.click(saveBtn);

            await waitFor(() => {
                expect(governanceActions.createMasterField).toHaveBeenCalledWith(expect.objectContaining({ allowAttachments: false }));
            });
        });
    });
});
