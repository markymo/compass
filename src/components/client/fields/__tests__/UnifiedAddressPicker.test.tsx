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
        X: () => <span data-testid="icon-X">X</span>,
        MapPin: () => <span data-testid="icon-MapPin">MapPin</span>,
        Check: () => <span data-testid="icon-Check">Check</span>,
    };
});
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { UnifiedAddressPicker } from '../UnifiedAddressPicker';
import * as actions from '@/actions/kyc-manual-update';
import * as addressActions from '@/actions/cc-address-actions';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);

// Mock Dialog
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
    }
});

vi.mock('@/actions/kyc-manual-update', () => ({
    createCCAddressAndReferenceField: vi.fn(),
    addExistingCCAddressReferenceToField: vi.fn()
}));

vi.mock('@/actions/cc-address-actions', () => ({
    searchCCAddresses: vi.fn().mockResolvedValue([])
}));

const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
vi.mock('sonner', () => ({
    __esModule: true,
    toast: { success: (...args) => mockToastSuccess(...args), error: (...args) => mockToastError(...args) }
}));

const testClientLEId = 'test-client-le';

const mockAddress1 = {
    id: 'addr-1',
    data: {
        addressLines: ['123 Test St'],
        locality: 'Test City',
        countryCode: 'GB'
    }
};

describe('UnifiedAddressPicker Regression', () => {
    afterEach(() => { cleanup(); vi.clearAllMocks(); });
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders CCAddressSelector and allows picking an existing address', async () => {
        vi.mocked(addressActions.searchCCAddresses).mockResolvedValueOnce([mockAddress1]);
        const onSuccess = vi.fn();
        
        render(<UnifiedAddressPicker clientLEId={testClientLEId} fieldNo={100} onSuccess={onSuccess} />);
        
        const openTrigger = screen.getByRole('button', { name: /Add Address/i });
        fireEvent.click(openTrigger);

        const btn = await screen.findByText('123 Test St, Test City, United Kingdom');
        
        vi.mocked(actions.addExistingCCAddressReferenceToField).mockResolvedValueOnce({ success: true, message: 'OK' });
        
        fireEvent.click(btn.closest('button')!);

        await waitFor(() => {
            expect(actions.addExistingCCAddressReferenceToField).toHaveBeenCalledWith(
                testClientLEId,
                100,
                'addr-1',
                undefined
            );
            expect(mockToastSuccess).toHaveBeenCalledWith('Address added successfully');
            expect(onSuccess).toHaveBeenCalled();
        });
    });

    it('allows creating a new address and binds it to the field', async () => {
        const onSuccess = vi.fn();
        render(<UnifiedAddressPicker clientLEId={testClientLEId} fieldNo={100} rowId="row-123" onSuccess={onSuccess} />);
        
        fireEvent.click(screen.getByRole('button', { name: /Add Address/i }));
        fireEvent.click(screen.getByRole('button', { name: /Create new address/i }));

        // Check if editor is rendered
        expect(screen.getByText(/Create New Address/i)).toBeInTheDocument();

        // Find the input for addressLines in AddressValueEditor
        // Assuming AddressValueEditor has a known placeholder or UI we can interact with.
        const addLineBtn = screen.getByRole('button', { name: /Add line/i });
        fireEvent.click(addLineBtn);

        const allInputs = screen.getAllByRole('textbox');
        fireEvent.change(allInputs[0], { target: { value: 'New Test St' } });

        vi.mocked(actions.createCCAddressAndReferenceField).mockResolvedValueOnce({ success: true, message: 'OK' });
        
        fireEvent.click(screen.getByRole('button', { name: /Save & Select/i }));

        await waitFor(() => {
            expect(actions.createCCAddressAndReferenceField).toHaveBeenCalledWith(
                testClientLEId,
                100,
                expect.objectContaining({
                    addressLines: expect.arrayContaining(['New Test St'])
                }),
                'row-123'
            );
            expect(onSuccess).toHaveBeenCalled();
        });
    });

    it('displays errors and prevents duplicate submissions', async () => {
        vi.mocked(addressActions.searchCCAddresses).mockResolvedValueOnce([mockAddress1]);
        render(<UnifiedAddressPicker clientLEId={testClientLEId} fieldNo={100} />);
        
        const openTrigger = screen.getByRole('button', { name: /Add Address/i });
        fireEvent.click(openTrigger);

        const btn = await screen.findByText('123 Test St, Test City, United Kingdom');
        const selectButton = btn.closest('button')!;

        // Mock long running action that fails
        let resolveAction: any;
        vi.mocked(actions.addExistingCCAddressReferenceToField).mockImplementation(() => new Promise(resolve => {
            resolveAction = resolve;
        }));

        fireEvent.click(selectButton);

        // While pending, button is disabled
        expect(selectButton).toBeDisabled();

        // Resolve with error
        resolveAction({ success: false, message: 'Failed to add' });

        await waitFor(() => {
            expect(mockToastError).toHaveBeenCalledWith('Failed to add');
        });
    });
});
