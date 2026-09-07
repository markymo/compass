// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { DataSchemaTab } from '../data-schema-tab';

// Mock next-auth
vi.mock('next-auth', () => ({
    getServerSession: vi.fn(),
    default: () => ({ handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }),
}));
vi.mock('next-auth/react', () => ({
    useSession: () => ({ data: { user: { id: 'test-user' } }, status: 'authenticated' }),
    getSession: vi.fn(),
}));

// Mock tooltips
vi.mock('@/components/ui/tooltip', () => ({
    TooltipProvider: ({ children }: any) => <>{children}</>,
    Tooltip: ({ children }: any) => <div data-testid="tooltip">{children}</div>,
    TooltipTrigger: ({ children }: any) => <>{children}</>,
    TooltipContent: ({ children }: any) => <div data-testid="tooltip-content">{children}</div>,
}));

// Mock kanban actions
vi.mock('@/actions/kanban-actions', () => ({
    getLETeamMembers: vi.fn().mockResolvedValue({ success: true, team: [] }),
}));

vi.mock('@/actions/system', () => ({
    getRegistryAuthorityNamesMap: vi.fn(() => Promise.resolve({})),
}));

vi.mock('@/actions/client-le', () => ({
    getFieldUsageDetails: vi.fn().mockResolvedValue({ success: true, usage: {} }),
}));

vi.mock('@/actions/kyc-query', () => ({
    getFieldDetail: vi.fn().mockResolvedValue({ success: true, field: null }),
}));

// Mock router / navigation
let mockSearchParams = new URLSearchParams();
const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), replace: mockReplace, prefetch: vi.fn(), back: vi.fn() }),
    usePathname: () => '/master',
    useSearchParams: () => mockSearchParams,
}));

// Mock preferences provider
let mockPreferences: any = {};
const mockUpdatePreference = vi.fn().mockResolvedValue(undefined);
vi.mock('@/components/providers/user-preferences-provider', () => ({
    usePreferences: () => ({
        preferences: mockPreferences,
        isLoading: false,
        updatePreference: mockUpdatePreference,
    }),
}));

describe('DataSchemaTab - Expand/Collapse Persistence (ONP-194)', () => {
    const sampleCategories = [
        {
            id: 'cat-identity',
            key: 'identity',
            displayName: 'Corporate Identity',
            order: 1,
            fields: [
                { fieldNo: 10, fieldName: 'Legal Name', appDataType: 'TEXT', isMultiValue: false },
                { fieldNo: 11, fieldName: 'Trade Name', appDataType: 'TEXT', isMultiValue: false }
            ]
        },
        {
            id: 'cat-ownership',
            key: 'ownership',
            displayName: 'Ownership & Management',
            order: 2,
            fields: [
                { fieldNo: 20, fieldName: 'Ultimate Beneficial Owners', appDataType: 'PARTY', isMultiValue: true }
            ]
        }
    ];

    const sampleMasterData: Record<number, any> = {
        10: { value: 'Acme Corp Ltd', displayState: 'HAS_VALUE' },
        11: { value: 'Acme', displayState: 'HAS_VALUE' },
        20: { value: [{ firstName: 'Alice', lastName: 'Smith' }], displayState: 'HAS_VALUE' }
    };

    const sampleCustomDefs = [
        { id: 'custom-1', key: 'custom-1', label: 'Internal Risk Rating', description: 'Custom risk tier' }
    ];
    const sampleCustomData = {
        'custom-1': { value: 'Low Risk', source: 'USER_INPUT' }
    };

    const sampleUncategorized = [
        { fieldNo: 99, fieldName: 'Uncategorized Extra Field', appDataType: 'TEXT', isMultiValue: false }
    ];
    const sampleUncategorizedData: Record<number, any> = {
        ...sampleMasterData,
        99: { value: 'Extra Info', displayState: 'HAS_VALUE' }
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockSearchParams = new URLSearchParams();
        mockPreferences = {};
    });

    afterEach(() => {
        cleanup();
    });

    // 1. Fresh / uninitialized user preference -> all Master Record categories collapsed
    it('1. defaults to collapsed all when preferences are uninitialized (fresh user)', () => {
        mockPreferences = {};

        render(
            <DataSchemaTab
                leId="cle_1"
                masterData={sampleUncategorizedData}
                customData={sampleCustomData}
                customDefinitions={sampleCustomDefs}
                masterFields={[]}
                masterGroups={[]}
                categories={sampleCategories}
                uncategorizedFields={sampleUncategorized}
            />
        );

        // Category headers exist
        expect(screen.getByText('Corporate Identity')).toBeTruthy();
        expect(screen.getByText('Ownership & Management')).toBeTruthy();
        expect(screen.getByText('Custom Fields')).toBeTruthy();
        expect(screen.getByText('Uncategorized')).toBeTruthy();

        // Field content should NOT be rendered in DOM because categories are collapsed
        expect(screen.queryByText('Acme Corp Ltd')).toBeNull();
        expect(screen.queryByText('Ultimate Beneficial Owners')).toBeNull();
        expect(screen.queryByText('Internal Risk Rating')).toBeNull();
        expect(screen.queryByText('Uncategorized Extra Field')).toBeNull();
    });

    // 2. Persisted expanded category -> restored when the Master Record opens
    it('2. restores persisted expanded category when opening Master Record', () => {
        mockPreferences = {
            masterRecord: {
                expandedCategories: ['cat-identity']
            }
        };

        render(
            <DataSchemaTab
                leId="cle_1"
                masterData={sampleMasterData}
                customData={{}}
                customDefinitions={[]}
                masterFields={[]}
                masterGroups={[]}
                categories={sampleCategories}
                uncategorizedFields={[]}
            />
        );

        // Fields inside cat-identity should be visible
        expect(screen.getByText('Acme Corp Ltd')).toBeTruthy();
        // Fields inside cat-ownership should NOT be visible
        expect(screen.queryByText('Ultimate Beneficial Owners')).toBeNull();
    });

    // 3. Clicking a category toggles it and persists the new state
    it('3. clicking a category toggles it and calls updatePreference with updated list', async () => {
        mockPreferences = {
            masterRecord: {
                expandedCategories: []
            }
        };

        render(
            <DataSchemaTab
                leId="cle_1"
                masterData={sampleMasterData}
                customData={{}}
                customDefinitions={[]}
                masterFields={[]}
                masterGroups={[]}
                categories={sampleCategories}
                uncategorizedFields={[]}
            />
        );

        const identityHeader = screen.getByRole('button', { name: /toggle corporate identity category/i });
        fireEvent.click(identityHeader);

        expect(mockUpdatePreference).toHaveBeenCalledWith('masterRecord', {
            expandedCategories: ['cat-identity']
        });
    });

    // 4. Expand All persists all eligible categories
    it('4. clicking Expand all persists all eligible category IDs', () => {
        mockPreferences = {
            masterRecord: {
                expandedCategories: []
            }
        };

        render(
            <DataSchemaTab
                leId="cle_1"
                masterData={sampleUncategorizedData}
                customData={sampleCustomData}
                customDefinitions={sampleCustomDefs}
                masterFields={[]}
                masterGroups={[]}
                categories={sampleCategories}
                uncategorizedFields={sampleUncategorized}
            />
        );

        const expandAllBtn = screen.getByRole('button', { name: /expand all/i });
        fireEvent.click(expandAllBtn);

        expect(mockUpdatePreference).toHaveBeenCalledWith('masterRecord', {
            expandedCategories: expect.arrayContaining(['CUSTOM', 'UNCATEGORIZED', 'cat-identity', 'cat-ownership'])
        });
    });

    // 5. Collapse All persists []
    it('5. clicking Collapse all persists an empty array []', () => {
        mockPreferences = {
            masterRecord: {
                expandedCategories: ['cat-identity', 'cat-ownership']
            }
        };

        render(
            <DataSchemaTab
                leId="cle_1"
                masterData={sampleMasterData}
                customData={{}}
                customDefinitions={[]}
                masterFields={[]}
                masterGroups={[]}
                categories={sampleCategories}
                uncategorizedFields={[]}
            />
        );

        const collapseAllBtn = screen.getByRole('button', { name: /collapse all/i });
        fireEvent.click(collapseAllBtn);

        expect(mockUpdatePreference).toHaveBeenCalledWith('masterRecord', {
            expandedCategories: []
        });
    });

    // 6. Search/filter temporarily expands categories containing matches
    it('6. search query temporarily expands matching categories without updating preference', () => {
        mockPreferences = {
            masterRecord: {
                expandedCategories: []
            }
        };
        // Simulate search for "Beneficial"
        mockSearchParams = new URLSearchParams('search=Beneficial');

        render(
            <DataSchemaTab
                leId="cle_1"
                masterData={sampleMasterData}
                customData={{}}
                customDefinitions={[]}
                masterFields={[]}
                masterGroups={[]}
                categories={sampleCategories}
                uncategorizedFields={[]}
            />
        );

        // Matching category should effectively expand to show the field
        expect(screen.getByText('Alice Smith')).toBeTruthy();
        // updatePreference must NOT be called on search override
        expect(mockUpdatePreference).not.toHaveBeenCalled();
    });

    // 7. Clearing search/filter restores the user's persisted expansion state
    it('7. clearing search restores user persisted expansion state without modifying preferences', () => {
        mockPreferences = {
            masterRecord: {
                expandedCategories: []
            }
        };
        mockSearchParams = new URLSearchParams('search=Beneficial');

        const { rerender } = render(
            <DataSchemaTab
                leId="cle_1"
                masterData={sampleMasterData}
                customData={{}}
                customDefinitions={[]}
                masterFields={[]}
                masterGroups={[]}
                categories={sampleCategories}
                uncategorizedFields={[]}
            />
        );

        expect(screen.getByText('Alice Smith')).toBeTruthy();

        // Clear search
        mockSearchParams = new URLSearchParams();
        rerender(
            <DataSchemaTab
                leId="cle_1"
                masterData={sampleMasterData}
                customData={{}}
                customDefinitions={[]}
                masterFields={[]}
                masterGroups={[]}
                categories={sampleCategories}
                uncategorizedFields={[]}
            />
        );

        // Should return to collapsed
        expect(screen.queryByText('Alice Smith')).toBeNull();
        expect(mockUpdatePreference).not.toHaveBeenCalled();
    });

    // 8. ?fieldNo=X temporarily opens the category containing that field
    it('8. ?fieldNo=X deep link temporarily opens containing category without persisting preference', () => {
        mockPreferences = {
            masterRecord: {
                expandedCategories: []
            }
        };
        mockSearchParams = new URLSearchParams('fieldNo=20');

        render(
            <DataSchemaTab
                leId="cle_1"
                masterData={sampleMasterData}
                customData={{}}
                customDefinitions={[]}
                masterFields={[{ fieldNo: 20, fieldName: 'Ultimate Beneficial Owners' }]}
                masterGroups={[]}
                categories={sampleCategories}
                uncategorizedFields={[]}
            />
        );

        // Field should be visible because cat-ownership was temporarily expanded
        expect(screen.getByText('Alice Smith')).toBeTruthy();
        expect(mockUpdatePreference).not.toHaveBeenCalled();
    });

    // 9. Removing/navigating away from the deep link leaves user persisted preference unchanged
    it('9. removing ?fieldNo deep link restores persisted state without touching preference', () => {
        mockPreferences = {
            masterRecord: {
                expandedCategories: []
            }
        };
        mockSearchParams = new URLSearchParams('fieldNo=20');

        const { rerender } = render(
            <DataSchemaTab
                leId="cle_1"
                masterData={sampleMasterData}
                customData={{}}
                customDefinitions={[]}
                masterFields={[{ fieldNo: 20, fieldName: 'Ultimate Beneficial Owners' }]}
                masterGroups={[]}
                categories={sampleCategories}
                uncategorizedFields={[]}
            />
        );

        expect(screen.getByText('Alice Smith')).toBeTruthy();

        // Remove param
        mockSearchParams = new URLSearchParams();
        rerender(
            <DataSchemaTab
                leId="cle_1"
                masterData={sampleMasterData}
                customData={{}}
                customDefinitions={[]}
                masterFields={[{ fieldNo: 20, fieldName: 'Ultimate Beneficial Owners' }]}
                masterGroups={[]}
                categories={sampleCategories}
                uncategorizedFields={[]}
            />
        );

        expect(screen.queryByText('Alice Smith')).toBeNull();
        expect(mockUpdatePreference).not.toHaveBeenCalled();
    });

    // 10. Unmount/remount or equivalent preference rehydration restores saved state
    it('10. rehydrates expanded state when preferences arrive or change', () => {
        mockPreferences = {
            masterRecord: {
                expandedCategories: ['cat-ownership']
            }
        };

        render(
            <DataSchemaTab
                leId="cle_1"
                masterData={sampleMasterData}
                customData={{}}
                customDefinitions={[]}
                masterFields={[]}
                masterGroups={[]}
                categories={sampleCategories}
                uncategorizedFields={[]}
            />
        );

        expect(screen.getByText('Ultimate Beneficial Owners')).toBeTruthy();
        expect(screen.queryByText('Acme Corp Ltd')).toBeNull();
    });

    // 11. Changing from one ClientLE to another preserves the same user category preference
    it('11. preserves category expansion preferences across different ClientLEs', () => {
        mockPreferences = {
            masterRecord: {
                expandedCategories: ['cat-identity']
            }
        };

        const otherLEData: Record<number, any> = {
            10: { value: 'Beta Corp Ltd', displayState: 'HAS_VALUE' },
            11: { value: 'Beta', displayState: 'HAS_VALUE' },
            20: { value: [{ firstName: 'Bob', lastName: 'Jones' }], displayState: 'HAS_VALUE' }
        };

        const { rerender } = render(
            <DataSchemaTab
                leId="cle_1"
                masterData={sampleMasterData}
                customData={{}}
                customDefinitions={[]}
                masterFields={[]}
                masterGroups={[]}
                categories={sampleCategories}
                uncategorizedFields={[]}
            />
        );

        expect(screen.getByText('Acme Corp Ltd')).toBeTruthy();

        // Navigate to cle_2
        rerender(
            <DataSchemaTab
                leId="cle_2"
                masterData={otherLEData}
                customData={{}}
                customDefinitions={[]}
                masterFields={[]}
                masterGroups={[]}
                categories={sampleCategories}
                uncategorizedFields={[]}
            />
        );

        expect(screen.getByText('Beta Corp Ltd')).toBeTruthy();
        expect(screen.queryByText('Bob Jones')).toBeNull();
    });
});
