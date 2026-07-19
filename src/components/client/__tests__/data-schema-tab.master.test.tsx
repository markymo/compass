// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DataSchemaTab } from '../data-schema-tab';

// Mock next-auth to avoid next/server errors
vi.mock('next-auth', () => ({
    getServerSession: vi.fn(),
    default: () => ({ handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }),
}));
vi.mock('next-auth/react', () => ({
    useSession: () => ({ data: { user: { id: 'test-user' } }, status: 'authenticated' }),
    getSession: vi.fn(),
}));

vi.mock('@/components/ui/tooltip', () => ({
    TooltipProvider: ({ children }: any) => <>{children}</>,
    Tooltip: ({ children }: any) => <div data-testid="tooltip">{children}</div>,
    TooltipTrigger: ({ children }: any) => <>{children}</>,
    TooltipContent: ({ children }: any) => <div data-testid="tooltip-content">{children}</div>,
}));

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
    usePathname: () => '/master',
    useSearchParams: () => new URLSearchParams(),
}));

describe('DataSchemaTab - /master rendering boundary', () => {
    it('renders Field 62 repeated legacy Companies House Party objects using canonical model (no blanks, no unknown RA)', () => {
        // Construct canonical model simulating getFullMasterData output after our fix
        const masterData = {
            62: {
                value: [
                    { firstName: 'Alice', lastName: 'Smith', metadata_type: 'PERSON' },
                    { firstName: 'Bob', lastName: 'Jones', metadata_type: 'PERSON' },
                    { firstName: 'Charlie', lastName: 'Brown', metadata_type: 'PERSON' },
                    { firstName: 'Diana', lastName: 'Prince', metadata_type: 'PERSON' }
                ],
                source: 'COMPANIES_HOUSE',
                displayState: 'HAS_VALUE',
                canonicalDisplayModel: {
                    fieldNo: 62,
                    label: 'Ultimate Beneficial Owners',
                    state: 'POPULATED',
                    isMultiValue: true,
                    source: {
                        type: 'COMPANIES_HOUSE',
                        reference: 'RA000585',
                        label: 'Companies House - RA000585',
                        colorKey: 'REGISTRY'
                    },
                    value: {
                        kind: 'collection',
                        items: [
                            {
                                value: { kind: 'party', partyLabel: 'Alice Smith', data: { firstName: 'Alice', lastName: 'Smith' } },
                                source: { type: 'COMPANIES_HOUSE', reference: 'RA000585', label: 'Companies House - RA000585', colorKey: 'REGISTRY' }
                            },
                            {
                                value: { kind: 'party', partyLabel: 'Bob Jones', data: { firstName: 'Bob', lastName: 'Jones' } },
                                source: { type: 'COMPANIES_HOUSE', reference: 'RA000585', label: 'Companies House - RA000585', colorKey: 'REGISTRY' }
                            },
                            {
                                value: { kind: 'party', partyLabel: 'Charlie Brown', data: { firstName: 'Charlie', lastName: 'Brown' } },
                                source: { type: 'COMPANIES_HOUSE', reference: 'RA000585', label: 'Companies House - RA000585', colorKey: 'REGISTRY' }
                            },
                            {
                                value: { kind: 'party', partyLabel: 'Diana Prince', data: { firstName: 'Diana', lastName: 'Prince' } },
                                source: { type: 'COMPANIES_HOUSE', reference: 'RA000585', label: 'Companies House - RA000585', colorKey: 'REGISTRY' }
                            }
                        ]
                    }
                }
            }
        };

        const categories = [
            {
                id: 'cat-1',
                displayName: 'Test Category',
                fields: [
                    { fieldNo: 62, fieldName: 'Ultimate Beneficial Owners', appDataType: 'PARTY', isMultiValue: true }
                ]
            }
        ];

        render(
            <DataSchemaTab
                leId="cle_1"
                masterData={masterData}
                customData={{}}
                customDefinitions={[]}
                masterFields={[]}
                masterGroups={[]}
                categories={categories}
                uncategorizedFields={[]}
            />
        );

        // 1. Assert four visible Party labels
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
        expect(screen.getByText('Bob Jones')).toBeInTheDocument();
        expect(screen.getByText('Charlie Brown')).toBeInTheDocument();
        expect(screen.getByText('Diana Prince')).toBeInTheDocument();

        // 2. Zero "—" placeholders for those Party rows
        const placeholders = screen.queryAllByText('—');
        expect(placeholders).toHaveLength(0);

        // 3. Companies House badge should be present (at least one for field level, plus row level)
        const chBadges = screen.getAllByText('Companies House - RA000585');
        expect(chBadges.length).toBeGreaterThan(0);

        // 4. No Registration Authority (unknown)
        const unknownBadges = screen.queryAllByText('Registration Authority (unknown)');
        expect(unknownBadges).toHaveLength(0);
    });

    it('renders Field 63 mixed-source without merging and uses Canonical labels', () => {
        // Construct Field 63 mixed-source control case
        const masterData = {
            63: {
                value: [
                    { firstName: 'Embedded', lastName: 'Source' },
                    { ccPartyId: 'p-123' }
                ],
                source: 'Multiple sources',
                displayState: 'HAS_VALUE',
                canonicalDisplayModel: {
                    fieldNo: 63,
                    label: 'Mixed Parties',
                    state: 'POPULATED',
                    isMultiValue: true,
                    source: {
                        type: 'Multiple sources',
                        label: 'Multiple sources',
                        colorKey: 'SYSTEM'
                    },
                    value: {
                        kind: 'collection',
                        items: [
                            {
                                value: { kind: 'party', partyLabel: 'Embedded Source', data: { firstName: 'Embedded', lastName: 'Source' } },
                                source: { type: 'COMPANIES_HOUSE', label: 'Companies House', colorKey: 'REGISTRY' }
                            },
                            {
                                value: { kind: 'party', partyLabel: 'Manual Party', resolved: { name: 'Manual Party' } },
                                source: { type: 'USER_INPUT', label: 'User input', colorKey: 'USER' }
                            }
                        ]
                    }
                }
            }
        };

        const categories = [
            {
                id: 'cat-2',
                displayName: 'Test Category 2',
                fields: [
                    { fieldNo: 63, fieldName: 'Mixed Parties', appDataType: 'PARTY', isMultiValue: true }
                ]
            }
        ];

        render(
            <DataSchemaTab
                leId="cle_1"
                masterData={masterData}
                customData={{}}
                customDefinitions={[]}
                masterFields={[]}
                masterGroups={[]}
                categories={categories}
                uncategorizedFields={[]}
            />
        );

        // Both rows render with canonical labels
        expect(screen.getByText('Embedded Source')).toBeInTheDocument();
        expect(screen.getByText('Manual Party')).toBeInTheDocument();

        // Field-level provenance is Multiple sources
        expect(screen.getAllByText('Multiple sources').length).toBeGreaterThan(0);

        // Row-level provenance remains available
        expect(screen.getAllByText('Companies House').length).toBeGreaterThan(0);
        expect(screen.getAllByText('User input').length).toBeGreaterThan(0);
    });
});
