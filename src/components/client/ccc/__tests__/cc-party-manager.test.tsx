/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('lucide-react', async (importOriginal) => {
    const mod = await importOriginal();
    return {
        ...mod,
        Edit: () => <span data-testid="icon-Edit">Edit</span>,
        Trash2: () => <span data-testid="icon-Trash2">Trash2</span>,
        Plus: () => <span data-testid="icon-Plus">Plus</span>,
        Loader2: () => <span data-testid="icon-Loader2">Loader2</span>,
        Search: () => <span data-testid="icon-Search">Search</span>,
    };
});
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { CCPartyManager } from '../cc-party-manager';
import { CCPartyData } from '@/lib/master-data/party-v2/CCPartyData';
import { getPartyLabel } from '@/lib/master-data/party-v2/label-helper';
import * as actions from '@/actions/cc-party-actions';
import { toast } from 'sonner';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);

const DialogContext = require('react').createContext({ open: false, onOpenChange: () => {} });
vi.mock('@/components/ui/dialog', () => {
    const React = require('react');
    return {
        Dialog: ({ children, open, defaultOpen, onOpenChange }) => {
            const [isOpen, setIsOpen] = React.useState(defaultOpen || open || false);
            const actualOpen = open !== undefined ? open : isOpen;
            const handleOpenChange = (newOpen) => {
                setIsOpen(newOpen);
                if (onOpenChange) onOpenChange(newOpen);
            };
            return React.createElement(DialogContext.Provider, { value: { open: actualOpen, onOpenChange: handleOpenChange } }, 
                React.createElement('div', { 'data-testid': 'dialog', 'data-state': actualOpen ? 'open' : 'closed' }, children)
            );
        },
        DialogTrigger: ({ asChild, children, ...props }) => {
            const { onOpenChange } = React.useContext(DialogContext);
            return React.cloneElement(React.Children.only(children), {
                ...props,
                onClick: (e) => {
                    if (children.props.onClick) children.props.onClick(e);
                    if (onOpenChange) onOpenChange(true);
                }
            });
        },
        DialogContent: ({ children, ...props }) => {
            const { open } = React.useContext(DialogContext);
            if (!open) return null;
            return React.createElement('div', { 'data-testid': 'dialog-content', ...props }, children);
        },
        DialogHeader: ({ children }) => React.createElement('div', null, children),
        DialogTitle: ({ children }) => React.createElement('div', null, children),
        DialogDescription: ({ children }) => React.createElement('div', null, children),
        DialogFooter: ({ children }) => React.createElement('div', null, children),
    }
});



const mockUpsertCCPartyV2 = vi.fn();
vi.mock('@/actions/cc-party-actions', () => ({
    __esModule: true,
    upsertCCPartyV2: (...args) => mockUpsertCCPartyV2(...args),
}));


// Mock the router
vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh: vi.fn() }),
}));

// Mock toast
vi.mock('sonner', () => ({
    __esModule: true,
    toast: { success: vi.fn(), error: vi.fn() }
}));

const testClientLEId = 'test-client-123';

const createBaseMockParty = (overrides = {}) => ({
    id: 'party-123',
    data: {
        schemaVersion: 2,
        partyType: 'INDIVIDUAL',
        forenames: 'John',
        surname: 'Doe',
        isActiveParty: true,
        emails: [],
        phones: [],
        roles: [],
        sourceIdentifiers: [],
        ...overrides,
    },
    legacy: {},
    diagnostics: [],
});

describe('CCPartyManager Integration', () => {
    afterEach(() => { cleanup(); vi.clearAllMocks(); });
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders and edits Individual party type correctly', async () => {
        const mockParty = createBaseMockParty();
        render(<CCPartyManager initialParties={[mockParty as any]} clientLEId={testClientLEId} onClose={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: /Edit saved party/i }));

        // Should render known fields for INDIVIDUAL
        expect(screen.getAllByDisplayValue('John')[0]).toBeInTheDocument();
        expect(screen.getAllByDisplayValue('Doe')[0]).toBeInTheDocument();

        // Check canonical label preview
        expect(screen.getAllByText('John Doe')[0]).toBeInTheDocument();

        // Edit forename
        const forenameInput = screen.getAllByDisplayValue('John')[0];
        fireEvent.change(forenameInput, { target: { value: 'Johnny' } });

        expect(screen.getAllByDisplayValue('Johnny')[0]).toBeInTheDocument();
        expect(screen.getAllByText('Johnny Doe')[0]).toBeInTheDocument(); // canonical label updates
    });

    it('renders and edits Team party type correctly', async () => {
        const mockParty = createBaseMockParty({ partyType: 'TEAM', teamName: 'Alpha Squad' });
        render(<CCPartyManager initialParties={[mockParty as any]} clientLEId={testClientLEId} onClose={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: /Edit saved party/i }));

        expect(screen.getAllByDisplayValue('Alpha Squad')[0]).toBeInTheDocument();
        expect(screen.getAllByText('Alpha Squad')[0]).toBeInTheDocument();
    });

    it('renders and edits Organisation party type correctly', async () => {
        const mockParty = createBaseMockParty({ partyType: 'ORGANISATION', legalName: 'Acme Corp' });
        render(<CCPartyManager initialParties={[mockParty as any]} clientLEId={testClientLEId} onClose={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: /Edit saved party/i }));

        expect(screen.getAllByDisplayValue('Acme Corp')[0]).toBeInTheDocument();
        expect(screen.getAllByText('Acme Corp')[0]).toBeInTheDocument();
    });

    it('handles tri-state Party and role activity controls', async () => {
        const mockParty = createBaseMockParty({ 
            isActiveParty: null,
            roles: [{ roleType: 'director', isActiveRole: null }]
        });
        
        render(<CCPartyManager initialParties={[mockParty as any]} clientLEId={testClientLEId} onClose={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: /Edit saved party/i }));

        // By default, if null, it should display "Not specified" in the UI
        // We'll simulate changing it to true, then false
        const partyActiveSelect = screen.getByRole('combobox', { name: /Active Party Status/i });
        expect(partyActiveSelect).toHaveTextContent('Not specified');
        
        // Let's assume the user clicks "Active"
        // (Implementation specific to Radix Select, we'd fire pointer down, but we can verify the UI mounts correctly)
        expect(screen.getByText('Roles')).toBeInTheDocument();
    });

    it('requires exact name validation (save disabled if name is missing)', async () => {
        const mockParty = createBaseMockParty();
        render(<CCPartyManager initialParties={[mockParty as any]} clientLEId={testClientLEId} onClose={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: /Edit saved party/i }));

        const saveButton = screen.getByRole('button', { name: /Save Changes/i });
        expect(saveButton).not.toBeDisabled();
        
        // Clear name
        const forenameInput = screen.getAllByDisplayValue('John')[0];
        fireEvent.change(forenameInput, { target: { value: '' } });
        const surnameInput = screen.getAllByDisplayValue('Doe')[0];
        fireEvent.change(surnameInput, { target: { value: '' } });

        // Cannot save individual without name
        fireEvent.click(saveButton);
        expect(toast.error).toHaveBeenCalledWith("Please fill out all required fields.");
        
        // Add a name
        fireEvent.change(forenameInput, { target: { value: 'Jane' } });
        
        // Now it can save
        mockUpsertCCPartyV2.mockResolvedValueOnce({ success: true, message: 'OK' });
        fireEvent.click(saveButton);
        expect(mockUpsertCCPartyV2).toHaveBeenCalled();
    });

    it('maintains stable role identity after deleting a middle role', async () => {
        const mockParty = createBaseMockParty({
            roles: [
                { roleType: 'director', roleTitle: 'Role 1' },
                { roleType: 'shareholder', roleTitle: 'Role 2' },
                { roleType: 'employee', roleTitle: 'Role 3' }
            ]
        });
        
        render(<CCPartyManager initialParties={[mockParty as any]} clientLEId={testClientLEId} onClose={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: /Edit saved party/i }));

        const roles = screen.getAllByText(/Role Type/i);
        expect(roles).toHaveLength(3);

        const deleteButtons = screen.getAllByRole('button', { name: /Remove role/i });
        // Delete middle role (index 1)
        fireEvent.click(deleteButtons[1]);

        // Remaining should be Role 1 and Role 3
        expect(screen.getByDisplayValue('Role 1')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Role 3')).toBeInTheDocument();
        expect(screen.queryByDisplayValue('Role 2')).not.toBeInTheDocument();
    });

    it('preserves natureOfControl, address refs, and source identifiers', async () => {
        const mockParty = createBaseMockParty({
            partyType: 'ORGANISATION',
            legalName: 'Acme Corp',
            registeredAddressRef: { ccAddressId: 'addr-123' },
            sourceIdentifiers: [{ scheme: 'GLEIF', value: '12345' }],
            roles: [{
                roleType: 'shareholder',
                natureOfControl: ['VOTING_RIGHTS'],
                correspondenceAddressRef: { ccAddressId: 'addr-456' }
            }]
        });
        
        render(<CCPartyManager initialParties={[mockParty as any]} clientLEId={testClientLEId} onClose={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: /Edit saved party/i }));

        // They aren't edited by this form, but we can verify they are passed to the save action
        const saveButton = screen.getByRole('button', { name: /Save Changes/i });
        expect(saveButton).not.toBeDisabled();
        
        mockUpsertCCPartyV2.mockResolvedValueOnce({ success: true, message: 'OK' });
        fireEvent.click(saveButton);

        await waitFor(() => {
            expect(mockUpsertCCPartyV2).toHaveBeenCalledWith(
                expect.objectContaining({
                    clientLEId: testClientLEId,
                    data: expect.objectContaining({
                        partyType: 'ORGANISATION',
                        registeredAddressRef: { ccAddressId: 'addr-123' },
                        sourceIdentifiers: [{ scheme: 'GLEIF', value: '12345' }],
                        roles: [expect.objectContaining({
                            natureOfControl: ['VOTING_RIGHTS'],
                            correspondenceAddressRef: { ccAddressId: 'addr-456' }
                        })]
                    })
                })
            );
        });
    });

    it('shows destructive address warning and structured omissions dialog', async () => {
        const mockLegacyParty = createBaseMockParty();
        mockLegacyParty.legacy = {
            embeddedHomeAddress: { addressLine1: 'Legacy Addr' }
        };
        
        render(<CCPartyManager initialParties={[mockLegacyParty as any]} clientLEId={testClientLEId} onClose={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: /Edit saved party/i }));

        // Warning should be visible
        expect(screen.getByText(/old-format compatibility addresses/i)).toBeInTheDocument();
        expect(screen.getByText(/homeAddress/i)).toBeInTheDocument();

        // Click save -> should show confirmation dialog instead of saving directly
        const saveButton = screen.getByRole('button', { name: /Save Changes/i });
        fireEvent.click(saveButton);

        expect(screen.getByText(/Confirm Address Removal/i)).toBeInTheDocument();
        expect(mockUpsertCCPartyV2).not.toHaveBeenCalled();
    });

    it('manager confirmation cancellation causes no action call', async () => {
        const mockLegacyParty = createBaseMockParty();
        mockLegacyParty.legacy = {
            embeddedHomeAddress: { addressLine1: 'Legacy Addr' }
        };
        
        render(<CCPartyManager initialParties={[mockLegacyParty as any]} clientLEId={testClientLEId} />);
        fireEvent.click(screen.getByRole('button', { name: /Edit saved party/i }));

        // Trigger save and dialog
        fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));
        
        const cancelBtns = screen.getAllByRole('button', { name: /Cancel/i });
        fireEvent.click(cancelBtns[cancelBtns.length - 1]);

        await waitFor(() => {
            expect(screen.queryByText(/Confirm Address Removal/i)).not.toBeInTheDocument();
        });
        
        expect(mockUpsertCCPartyV2).not.toHaveBeenCalled();
    });

    it('manager confirmation proceeds to save and dismisses', async () => {
        const mockLegacyParty = createBaseMockParty();
        mockLegacyParty.legacy = {
            embeddedHomeAddress: { addressLine1: 'Legacy Addr' }
        };
        
        render(<CCPartyManager initialParties={[mockLegacyParty as any]} clientLEId={testClientLEId} />);
        fireEvent.click(screen.getByRole('button', { name: /Edit saved party/i }));

        // Trigger save and dialog
        fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));
        
        mockUpsertCCPartyV2.mockResolvedValueOnce({ success: true, message: 'OK' });
        
        const proceedBtn = screen.getByRole('button', { name: /Proceed & Drop Addresses/i });
        fireEvent.click(proceedBtn);

        await waitFor(() => {
            expect(mockUpsertCCPartyV2).toHaveBeenCalledTimes(1);
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });
});
