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
import { UnifiedPartyPicker } from '../UnifiedPartyPicker';
import * as actions from '@/actions/kyc-manual-update';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);

const DialogContext = require('react').createContext({ open: false, onOpenChange: () => {} });
vi.mock("next-auth", () => ({
    default: vi.fn(() => ({
        handlers: {},
        auth: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn()
    }))
}));
vi.mock("next/server", () => ({ NextResponse: {} }));
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


vi.mock('@/actions/kyc-manual-update', () => ({
    createCCPartyAndReferenceField: vi.fn(),
    addExistingCCPartyReferenceToField: vi.fn()
}));

vi.mock('@/actions/cc-party-actions', () => ({
    searchCCParties: vi.fn().mockResolvedValue([])
}));


const mockToastError = vi.fn();
vi.mock('sonner', () => ({
    __esModule: true,
    toast: { success: vi.fn(), error: (...args) => mockToastError(...args) }
}));


const testClientLEId = 'test-client-le';

describe('UnifiedPartyPicker', () => {
    afterEach(() => { cleanup(); vi.clearAllMocks(); });
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the canonical editor when Create New is clicked', async () => {
        render(<UnifiedPartyPicker clientLEId={testClientLEId} fieldNo={63} />);
        
        const openTrigger = screen.getAllByRole('button', { name: /Add Party \/ Contact/i })[0];
        fireEvent.click(openTrigger);

        // Click create new
        const createNewBtn = screen.getAllByRole('button', { name: /Create new person \/ organisation/i })[0];
        fireEvent.click(createNewBtn);

        // Editor is rendered
        expect(screen.getByText(/Party Type/i)).toBeInTheDocument();
        expect(screen.getByText(/Status:/i)).toBeInTheDocument();
    });

    it('uses valid V2 defaults (INDIVIDUAL, isActiveParty: true) and submits correctly', async () => {
        render(<UnifiedPartyPicker clientLEId={testClientLEId} fieldNo={63} />);
        
        fireEvent.click(screen.getAllByRole('button', { name: /Add Party \/ Contact/i })[0]);
        fireEvent.click(screen.getAllByRole('button', { name: /Create new person \/ organisation/i })[0]);

        // Fill required fields for INDIVIDUAL (forename)
        const forenameLabel = screen.getByText('Forenames');
        const forenameInput = forenameLabel.parentElement?.querySelector('input');
        fireEvent.change(forenameInput!, { target: { value: 'TestName' } });

        const saveButton = screen.getByRole('button', { name: /Save & Select/i });
        expect(saveButton).not.toBeDisabled();

        vi.mocked(actions.createCCPartyAndReferenceField).mockResolvedValueOnce({ success: true, message: 'OK' });
        fireEvent.click(saveButton);

        await waitFor(() => {
            expect(actions.createCCPartyAndReferenceField).toHaveBeenCalledWith(
                testClientLEId,
                63,
                expect.objectContaining({
                    schemaVersion: 2,
                    partyType: 'INDIVIDUAL',
                    isActiveParty: true,
                    forenames: 'TestName'
                }),
                undefined
            );
        });

        // Ensure no legacy name fields, embedded addresses or visibility are submitted
        const submittedCall = vi.mocked(actions.createCCPartyAndReferenceField).mock.calls[0][2] as any;
        expect(submittedCall).not.toHaveProperty('contactType');
        expect(submittedCall).not.toHaveProperty('visibility');
        expect(submittedCall).not.toHaveProperty('embeddedHomeAddress');
    });

    it('displays errors and prevents duplicate submissions', async () => {
        render(<UnifiedPartyPicker clientLEId={testClientLEId} fieldNo={63} />);
        
        fireEvent.click(screen.getAllByRole('button', { name: /Add Party \/ Contact/i })[0]);
        fireEvent.click(screen.getAllByRole('button', { name: /Create new person \/ organisation/i })[0]);

        const forenameLabel = screen.getByText('Forenames');
        const forenameInput = forenameLabel.parentElement?.querySelector('input');
        fireEvent.change(forenameInput!, { target: { value: 'ErrorTest' } });

        // Mock long running action that fails
        let resolveAction: any;
        vi.mocked(actions.createCCPartyAndReferenceField).mockImplementation(() => new Promise(resolve => {
            resolveAction = resolve;
        }));

        const saveButton = screen.getByRole('button', { name: /Save & Select/i });
        fireEvent.click(saveButton);

        // While pending, button is disabled
        expect(saveButton).toBeDisabled();

        // Resolve with error
        resolveAction({ success: false, message: 'Failed to create' });

        await waitFor(() => {
            expect(mockToastError).toHaveBeenCalledWith('Failed to create');
        });
    });

    it('works when mounted from the Field Drawer journey (testing prop pass-through)', async () => {
        // Field drawer will pass fieldNo, clientLEId, and optionally rowId
        const onOk = vi.fn();
        render(<UnifiedPartyPicker clientLEId="drawer-le" fieldNo={100} rowId="row-123" onSuccess={onOk} />);
        
        fireEvent.click(screen.getAllByRole('button', { name: /Add Party \/ Contact/i })[0]);
        fireEvent.click(screen.getAllByRole('button', { name: /Create new person \/ organisation/i })[0]);

        const forenameLabel = screen.getByText('Forenames');
        const forenameInput = forenameLabel.parentElement?.querySelector('input');
        fireEvent.change(forenameInput!, { target: { value: 'DrawerTest' } });

        vi.mocked(actions.createCCPartyAndReferenceField).mockResolvedValueOnce({ success: true, message: 'OK' });
        fireEvent.click(screen.getByRole('button', { name: /Save & Select/i }));

        await waitFor(() => {
            expect(actions.createCCPartyAndReferenceField).toHaveBeenCalledWith(
                'drawer-le',
                100,
                expect.any(Object),
                'row-123'
            );
            expect(onOk).toHaveBeenCalled();
        });
    });
});
