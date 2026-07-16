/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('lucide-react', async (importOriginal) => {
    const mod = await importOriginal();
    return {
        ...mod,
        Search: () => <span data-testid="icon-Search">Search</span>,
        Plus: () => <span data-testid="icon-Plus">Plus</span>,
        MapPin: () => <span data-testid="icon-MapPin">MapPin</span>,
        Loader2: () => <span data-testid="icon-Loader2">Loader2</span>,
        X: () => <span data-testid="icon-X">X</span>,
        Check: () => <span data-testid="icon-Check">Check</span>,
    };
});

import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { CCAddressSelector } from '../CCAddressSelector';
import * as actions from '@/actions/cc-address-actions';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);

vi.mock('@/actions/cc-address-actions', () => ({
    searchCCAddresses: vi.fn().mockResolvedValue([])
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

describe('CCAddressSelector', () => {
    afterEach(() => { cleanup(); vi.clearAllMocks(); });
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('loads and displays existing addresses with correct client LE scoping', async () => {
        vi.mocked(actions.searchCCAddresses).mockResolvedValueOnce([mockAddress1]);
        const onSelect = vi.fn();
        
        render(<CCAddressSelector clientLEId={testClientLEId} onSelect={onSelect} />);

        await waitFor(() => {
            expect(actions.searchCCAddresses).toHaveBeenCalledWith(testClientLEId, "");
            expect(screen.getByText('123 Test St, Test City, United Kingdom')).toBeInTheDocument();
        });
    });

    it('emits PartyAddressRef when an address is selected', async () => {
        vi.mocked(actions.searchCCAddresses).mockResolvedValueOnce([mockAddress1]);
        const onSelect = vi.fn();
        
        render(<CCAddressSelector clientLEId={testClientLEId} onSelect={onSelect} />);

        const btn = await screen.findByText('123 Test St, Test City, United Kingdom');
        fireEvent.click(btn.closest('button')!);

        expect(onSelect).toHaveBeenCalledWith({ ccAddressId: 'addr-1' }, mockAddress1.data);
    });

    it('shows current reference and emits null when cleared', async () => {
        vi.mocked(actions.searchCCAddresses).mockResolvedValueOnce([mockAddress1]);
        const onSelect = vi.fn();
        
        render(<CCAddressSelector clientLEId={testClientLEId} currentRef={{ ccAddressId: 'addr-1' }} onSelect={onSelect} />);

        // Should display the current selection block
        expect(await screen.findByText('Current Selection')).toBeInTheDocument();
        
        const clearBtn = screen.getByRole('button', { name: /Clear/i });
        fireEvent.click(clearBtn);

        expect(onSelect).toHaveBeenCalledWith(null);
    });

    it('renders explicit broken reference state for missing addresses', async () => {
        vi.mocked(actions.searchCCAddresses).mockResolvedValueOnce([]); // Empty results
        const onSelect = vi.fn();
        
        render(<CCAddressSelector clientLEId={testClientLEId} currentRef={{ ccAddressId: 'missing-123' }} onSelect={onSelect} />);

        await waitFor(() => {
            expect(screen.getByText(/Broken Reference \/ Missing Address/i)).toBeInTheDocument();
            expect(screen.getByText(/\(ID: missing-123\)/i)).toBeInTheDocument();
        });
    });
});
