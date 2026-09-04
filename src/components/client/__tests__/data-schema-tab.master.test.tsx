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

vi.mock('@/actions/system', () => ({
    getRegistryAuthorityNamesMap: vi.fn(() => Promise.resolve({})),
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
                key: 'cat-1',
                displayName: 'Test Category',
                icon: () => <svg data-testid="dummy-icon" />,
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
        expect(screen.getByText('Alice Smith')).toBeTruthy();
        expect(screen.getByText('Bob Jones')).toBeTruthy();
        expect(screen.getByText('Charlie Brown')).toBeTruthy();
        expect(screen.getByText('Diana Prince')).toBeTruthy();

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
                                value: { kind: 'partyRef', partyLabel: 'Manual Party', resolved: { name: 'Manual Party' } },
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
                key: 'cat-2',
                displayName: 'Test Category 2',
                icon: () => <svg data-testid="dummy-icon" />,
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
        expect(screen.getByText('Embedded Source')).toBeTruthy();
        expect(screen.getByText('Manual Party')).toBeTruthy();

        // Field-level provenance is Multiple sources
        expect(screen.getAllByText('Multiple sources').length).toBeGreaterThan(0);

        // Row-level provenance remains available
        expect(screen.getAllByText('Companies House').length).toBeGreaterThan(0);
        expect(screen.getAllByText('User input').length).toBeGreaterThan(0);
    });

    describe('ONP-30: Master field description formatting on /master', () => {
        it('applies compact line spacing (leading-snug), removes blanket italic, and avoids artificial paragraph margin', () => {
            const descriptionWithNewlines = "First paragraph line one.\nFirst paragraph line two.\n\nSecond paragraph.";
            const categories = [
                {
                    id: 'cat-desc',
                    key: 'cat-desc',
                    displayName: 'Description Test Category',
                    icon: () => <svg data-testid="dummy-icon" />,
                    fields: [
                        { fieldNo: 70, fieldName: 'Compact Description Field', description: descriptionWithNewlines }
                    ]
                }
            ];

            render(
                <DataSchemaTab
                    leId="cle_1"
                    masterData={{ 70: { value: 'Test Value', displayState: 'HAS_VALUE' } }}
                    customData={{}}
                    customDefinitions={[]}
                    masterFields={[]}
                    masterGroups={[]}
                    categories={categories}
                    uncategorizedFields={[]}
                />
            );

            const fieldEl = screen.getByTestId('master-field-70');
            const descSpan = fieldEl.querySelector('.whitespace-pre-wrap');
            expect(descSpan).toBeTruthy();

            // A. Compact line spacing: leading-snug, NOT leading-relaxed
            expect(descSpan?.className).toContain('leading-snug');
            expect(descSpan?.className).not.toContain('leading-relaxed');

            // Blanket italic removed so explicit formatting is distinguishable
            expect(descSpan?.className).not.toContain('italic');

            // B. No artificial paragraph margin: should not introduce <p> tags with extra margins
            expect(descSpan?.querySelectorAll('p')).toHaveLength(0);
            expect(descSpan?.textContent).toContain('First paragraph line one.\nFirst paragraph line two.\n\nSecond paragraph.');
        });

        it('renders **bold** and *italic* formatting as strong and em while preserving plain text', () => {
            const formattedDesc = "This is **important** and this is *additional context*.";
            const categories = [
                {
                    id: 'cat-formatting',
                    key: 'cat-formatting',
                    displayName: 'Formatting Category',
                    icon: () => <svg data-testid="dummy-icon" />,
                    fields: [
                        { fieldNo: 71, fieldName: 'Formatted Field', description: formattedDesc }
                    ]
                }
            ];

            render(
                <DataSchemaTab
                    leId="cle_1"
                    masterData={{ 71: { value: 'Test Value', displayState: 'HAS_VALUE' } }}
                    customData={{}}
                    customDefinitions={[]}
                    masterFields={[]}
                    masterGroups={[]}
                    categories={categories}
                    uncategorizedFields={[]}
                />
            );

            const fieldEl = screen.getByTestId('master-field-71');
            const descSpan = fieldEl.querySelector('.whitespace-pre-wrap');
            expect(descSpan).toBeTruthy();

            // C. Bold and italic rendering
            const strongEl = descSpan?.querySelector('strong');
            expect(strongEl).toBeTruthy();
            expect(strongEl?.textContent).toBe('important');
            expect(strongEl?.className).toContain('font-semibold');

            const emEl = descSpan?.querySelector('em');
            expect(emEl).toBeTruthy();
            expect(emEl?.textContent).toBe('additional context');
            expect(emEl?.className).toContain('italic');

            // Preserves surrounding plain text
            expect(descSpan?.textContent).toContain('This is important and this is additional context.');
        });

        it('applies formatting to custom and uncategorised fields as well', () => {
            const customDefinitions = [
                {
                    id: 'custom-1',
                    key: 'custom_1',
                    label: 'Custom Field',
                    description: 'Custom **bold** description.'
                }
            ];
            const uncategorizedFields = [
                {
                    fieldNo: 72,
                    fieldName: 'Uncategorized Field',
                    description: 'Uncategorized *italic* description.'
                }
            ];

            render(
                <DataSchemaTab
                    leId="cle_1"
                    masterData={{ 72: { value: 'Uncat Value', displayState: 'HAS_VALUE' } }}
                    customData={{ 'custom-1': { value: 'Custom Value' } }}
                    customDefinitions={customDefinitions}
                    masterFields={[]}
                    masterGroups={[]}
                    categories={[]}
                    uncategorizedFields={uncategorizedFields}
                />
            );

            // Custom field description formatting
            const customLabel = screen.getByText('Custom Field');
            const customContainer = customLabel.closest('.group');
            const customDescSpan = customContainer?.querySelector('.whitespace-pre-wrap');
            expect(customDescSpan?.className).toContain('leading-snug');
            expect(customDescSpan?.className).not.toContain('italic');
            expect(customDescSpan?.querySelector('strong')?.textContent).toBe('bold');

            // Uncategorized field description formatting
            const uncatEl = screen.getByTestId('master-field-72');
            const uncatDescSpan = uncatEl.querySelector('.whitespace-pre-wrap');
            expect(uncatDescSpan?.className).toContain('leading-snug');
            expect(uncatDescSpan?.className).not.toContain('italic');
            expect(uncatDescSpan?.querySelector('em')?.textContent).toBe('italic');
        });
    });
});

