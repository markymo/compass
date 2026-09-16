// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { DataSchemaTab } from '../data-schema-tab';

afterEach(() => {
    cleanup();
});

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

const mockMasterPrefs = {
    masterRecord: {
        expandedCategories: ['cat-1']
    }
};

vi.mock('@/components/providers/user-preferences-provider', () => ({
    usePreferences: () => ({
        preferences: mockMasterPrefs,
        isLoading: false,
        updatePreference: vi.fn().mockResolvedValue(undefined),
    }),
}));

describe('DataSchemaTab - Attachment Indicator (ONP-46 / ONP-49)', () => {
    const baseCategory = {
        id: 'cat-1',
        key: 'cat-1',
        displayName: 'Governance',
        icon: () => <svg data-testid="governance-icon" />,
        fields: [] as any[]
    };

    it('renders attachment indicator when allowAttachments=false but an existing FIELD-scope attachment exists', () => {
        const masterData = {
            39: {
                value: 'Registered Office',
                source: 'USER_INPUT',
                displayState: 'HAS_VALUE',
                canonicalDisplayModel: {
                    fieldNo: 39,
                    label: 'Register Location',
                    state: 'POPULATED',
                    isMultiValue: false,
                    allowAttachments: false, // allowAttachments is FALSE
                    attachments: [
                        {
                            documentId: 'doc-field-1',
                            displayName: 'historic-register.pdf',
                            provenance: [
                                {
                                    type: 'FIELD',
                                    fieldAttachmentInstanceId: 'inst-field-1'
                                }
                            ]
                        }
                    ],
                    value: {
                        kind: 'scalar',
                        value: 'Registered Office'
                    }
                }
            }
        };

        const categories = [{
            ...baseCategory,
            fields: [
                { fieldNo: 39, fieldName: 'Register Location', appDataType: 'STRING', isMultiValue: false }
            ]
        }];

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

        // CONTRACT: Attachment indicator must be visible because a historic FIELD attachment exists
        const indicator = screen.queryByLabelText('1 attachment');
        expect(indicator).not.toBeNull();
    });

    it('does NOT render attachment indicator when allowAttachments=false and NO attachments exist', () => {
        const masterData = {
            40: {
                value: 'Some value',
                source: 'USER_INPUT',
                displayState: 'HAS_VALUE',
                canonicalDisplayModel: {
                    fieldNo: 40,
                    label: 'Field without attachments',
                    state: 'POPULATED',
                    isMultiValue: false,
                    allowAttachments: false,
                    attachments: [],
                    value: {
                        kind: 'scalar',
                        value: 'Some value'
                    }
                }
            }
        };

        const categories = [{
            ...baseCategory,
            fields: [
                { fieldNo: 40, fieldName: 'Field without attachments', appDataType: 'STRING', isMultiValue: false }
            ]
        }];

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

        // CONTRACT: No empty attachment indicator introduced
        const indicator = screen.queryByLabelText(/\d+\s+attachment/i);
        expect(indicator).toBeNull();
    });

    it('does NOT render field-level attachment indicator when attachments are only PARTY-owned (not FIELD provenance)', () => {
        const masterData = {
            104: {
                value: [{ ccPartyId: 'party-1' }],
                source: 'USER_INPUT',
                displayState: 'HAS_VALUE',
                canonicalDisplayModel: {
                    fieldNo: 104,
                    label: 'SSI callback contact(s)',
                    state: 'POPULATED',
                    isMultiValue: true,
                    allowAttachments: false,
                    attachments: [
                        {
                            documentId: 'doc-party-1',
                            displayName: 'WORD_TEST_DOC.docx',
                            provenance: [
                                {
                                    type: 'PARTY',
                                    partyId: 'party-1',
                                    partyName: 'Enviromena Limited'
                                }
                            ]
                        }
                    ],
                    value: {
                        kind: 'party',
                        partyLabel: 'Enviromena Limited',
                        data: { legalName: 'Enviromena Limited' }
                    }
                }
            }
        };

        const categories = [{
            ...baseCategory,
            fields: [
                { fieldNo: 104, fieldName: 'SSI callback contact(s)', appDataType: 'PARTY', isMultiValue: true }
            ]
        }];

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

        // CONTRACT: Party-owned attachments must NOT be misrepresented as field-level attachments on the field row
        const indicator = screen.queryByLabelText(/\d+\s+attachment/i);
        expect(indicator).toBeNull();
    });
});
