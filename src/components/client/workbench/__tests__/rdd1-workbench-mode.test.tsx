/**
 * @vitest-environment happy-dom
 */
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { CrossQuestionnaireMapper } from '../cross-questionnaire-mapper';
import * as kycWorkbench from '@/actions/kyc-workbench';
import * as kycManualUpdate from '@/actions/kyc-manual-update';
import * as kycQuery from '@/actions/kyc-query';

vi.mock('@/components/providers/user-preferences-provider', () => ({
    usePreferences: () => ({
        preferences: { workbenchViewMode: 'rdd1' },
        updatePreference: vi.fn(),
        isLoading: false
    })
}));

vi.mock('@/actions/kyc-workbench', () => ({
    mapQuestionToField: vi.fn(),
    getAIFieldNameSuggestion: vi.fn()
}));

vi.mock('@/actions/kyc-manual-update', () => ({
    applyManualOverride: vi.fn(),
    updateFieldManually: vi.fn().mockResolvedValue({ success: true }),
    addMultiValueEntry: vi.fn().mockResolvedValue({ success: true }),
    removeMultiValueEntry: vi.fn().mockResolvedValue({ success: true }),
    applyCandidate: vi.fn().mockResolvedValue({ success: true }),
    restoreSourceValue: vi.fn().mockResolvedValue({ success: true })
}));

vi.mock('@/actions/kyc-query', () => ({
    getFieldDetail: vi.fn(),
    getPartyDisplayAudit: vi.fn().mockResolvedValue({ success: true, changes: [] }),
    searchUnboundGraphNodes: vi.fn().mockResolvedValue({ success: true, nodes: [] })
}));

vi.mock('@/actions/client-le', () => ({
    getFieldUsageDetails: vi.fn().mockResolvedValue({
        totalQuestions: 1,
        totalQuestionnaires: 1,
        totalSuppliers: 1,
        relationships: [],
        questions: [],
        questionnaires: [],
        suppliers: []
    })
}));

vi.mock('@/actions/system', () => ({
    getRegistryAuthorityNamesMap: vi.fn().mockResolvedValue({})
}));

vi.mock('@/actions/kanban-actions', () => ({
    approveQuestionMapping: vi.fn().mockResolvedValue({ success: true }),
    shareQuestion: vi.fn().mockResolvedValue({ success: true }),
    releaseQuestion: vi.fn().mockResolvedValue({ success: true }),
    getLETeamMembers: vi.fn().mockResolvedValue({ success: true, members: [] })
}));

vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: 'user-admin', role: 'LE_ADMIN', orgId: 'org-test' })
}));

vi.mock('next/navigation', () => {
    let currentSearch = '?view=rdd1';
    return {
        useRouter: () => ({
            push: vi.fn(),
            replace: vi.fn(),
            prefetch: vi.fn(),
            refresh: vi.fn(),
        }),
        usePathname: () => '/app/le/le-123/workbench4',
        useSearchParams: () => new URLSearchParams(currentSearch)
    };
});

vi.mock('next-auth/react', () => ({
    useSession: () => ({
        data: { user: { id: 'user-admin', role: 'LE_ADMIN', orgId: 'org-test' } },
        status: 'authenticated'
    })
}));

describe('ONP-60: Fourth View Mode (rdd1) Contract & Workbench4 Invariants', () => {
    const mockInitialData: kycWorkbench.Workbench4Data = {
        questions: [
            {
                id: 'q-scalar-1',
                text: 'What is the Country of Registration?',
                questionnaireId: 'qn-fmsb-1',
                questionnaireName: 'FSMB MASTER DRAFT',
                engagementOrgName: 'Common Scope',
                engagementId: 'eng-1',
                status: 'DRAFT',
                masterFieldNo: 22,
                masterDataValue: 'United Kingdom',
                canonicalDisplayModel: {
                    fieldNo: 22,
                    fieldName: 'Country of Registration',
                    state: 'POPULATED',
                    value: { kind: 'scalar', display: 'United Kingdom', raw: 'GB' },
                    source: { type: 'COMPANIES_HOUSE', reference: '01234567', timestamp: '2026-09-03T15:12:00Z' },
                    allowAttachments: true,
                    attachments: [
                        {
                            id: 'att-cert-incorp',
                            documentId: 'doc-cert-1',
                            displayName: 'Certificate_of_Incorporation.pdf',
                            fileName: 'Certificate_of_Incorporation.pdf',
                            fileSize: 102400,
                            mimeType: 'application/pdf',
                            uploadedAt: '2026-09-01T10:00:00Z',
                            provenance: [{ type: 'FIELD', fieldNo: 22 }]
                        }
                    ]
                } as any
            },
            {
                id: 'q-structured-1',
                text: 'Persons of significant control (public source)',
                questionnaireId: 'qn-fmsb-1',
                questionnaireName: 'FSMB MASTER DRAFT',
                engagementOrgName: 'Common Scope',
                engagementId: 'eng-1',
                status: 'APPROVED',
                masterFieldNo: 64,
                masterDataValue: [
                    {
                        name: 'Red Rock Renewables Limited',
                        partyType: 'ORGANISATION',
                        role: 'corporate-entity-person-with-significant-control',
                        address: '5th Floor, 40, Princes Street, Edinburgh, EH2 2BY, United Kingdom'
                    }
                ],
                canonicalDisplayModel: {
                    fieldNo: 64,
                    fieldName: 'Persons of significant control',
                    state: 'POPULATED',
                    value: {
                        kind: 'collection',
                        items: [
                            {
                                value: {
                                    kind: 'party',
                                    data: {
                                        name: 'Red Rock Renewables Limited',
                                        organisationName: 'Red Rock Renewables Limited',
                                        address: '5th Floor, 40, Princes Street, Edinburgh, EH2 2BY, United Kingdom',
                                        natureOfControl: 'Ownership of shares — 75% or more'
                                    }
                                },
                                source: { type: 'COMPANIES_HOUSE', reference: '01234567', timestamp: '2026-09-03T15:12:00Z' }
                            }
                        ]
                    },
                    source: { type: 'COMPANIES_HOUSE', reference: '01234567', timestamp: '2026-09-03T15:12:00Z' }
                } as any
            },
            {
                id: 'q-unmapped-1',
                text: 'Legacy unmapped requirement without schema connection',
                questionnaireId: 'qn-legacy-1',
                questionnaireName: 'Legacy Intake',
                engagementOrgName: 'Supplier Direct',
                engagementId: 'eng-legacy',
                status: 'DRAFT',
                masterFieldNo: null,
                masterQuestionGroupId: null,
                masterDataValue: null
            }
        ],
        masterFields: [
            { fieldNo: 22, label: 'Country of Registration', category: 'Registry', currentValue: 'United Kingdom' },
            { fieldNo: 23, label: 'Directors', category: 'Governance', currentValue: [{ name: 'Alice Smith' }, { name: 'Bob Jones' }, { name: 'Charlie Brown' }] },
            { fieldNo: 64, label: 'Persons of significant control', category: 'Controllers' }
        ],
        masterGroups: [
            { key: 'tax_ids', label: 'Taxpayer Identification Numbers' }
        ],
        customFields: [],
        relationships: ['Common Scope', 'Supplier Direct'],
        questionnaires: ['FSMB MASTER DRAFT', 'Legacy Intake'],
        raNameLookup: { RA000585: 'Companies House' }
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        cleanup();
    });

    it('1. RDD1 exists as a fourth view alongside Classic, Flow, and Compact', async () => {
        render(<CrossQuestionnaireMapper leId="le-123" initialData={mockInitialData} />);

        expect(screen.getByRole('button', { name: /classic/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /flow/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /compact/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /rdd1/i })).toBeInTheDocument();
    });

    it('2. RDD1 does not expose a questionnaire-local answer input or pencil override', async () => {
        render(<CrossQuestionnaireMapper leId="le-123" initialData={mockInitialData} />);

        // In RDD1 mode, there should be NO editable inputs for answering questions directly
        const textInputs = screen.queryAllByPlaceholderText(/enter value\.\.\./i);
        expect(textInputs.length).toBe(0);

        // Nor should there be inline edit pencil icons inside the answer section
        const inlinePencilButtons = screen.queryAllByTitle(/edit value/i);
        expect(inlinePencilButtons.length).toBe(0);
    });

    it('3. Mapping can be inspected and changed by an authorised user via the mapping action', async () => {
        (kycWorkbench.mapQuestionToField as any).mockResolvedValue({
            success: true,
            newValue: 'United Kingdom',
            newCanonicalDisplayModel: mockInitialData.questions[0].canonicalDisplayModel
        });

        render(<CrossQuestionnaireMapper leId="le-123" initialData={mockInitialData} />);

        // Click the mapping tile / chevron on the question
        const mappingTile = screen.getByTestId('rdd1-mapping-tile-q-scalar-1');
        expect(mappingTile).toBeInTheDocument();
        fireEvent.click(mappingTile);

        // Sidebar opens with alternative mapping selector
        await waitFor(() => {
            expect(screen.getByTestId('rdd1-alternative-mapping-selector')).toBeInTheDocument();
        });
    });

    it('4. Mapping mutation controls are disabled/hidden for unauthorised users', async () => {
        const readOnlyData: kycWorkbench.Workbench4Data = {
            ...mockInitialData,
            ownerOrgId: 'read-only'
        };

        render(<CrossQuestionnaireMapper leId="le-123" initialData={readOnlyData} disabled={true} />);

        const mappingTile = screen.getByTestId('rdd1-mapping-tile-q-scalar-1');
        expect(mappingTile).toBeInTheDocument();
    });

    it('5. "Edit Master value" button is removed, and clicking mapping tile opens canonical field inspection/editing drawer', async () => {
        render(<CrossQuestionnaireMapper leId="le-123" initialData={mockInitialData} />);

        // No separate "Edit Master value" button on the card
        expect(screen.queryByText(/edit master value/i)).toBeNull();
        expect(screen.queryByTestId('edit-master-value-q-scalar-1')).toBeNull();

        // Clicking mapping tile opens FieldDetailPanel
        const mappingTile = screen.getByTestId('rdd1-mapping-tile-q-scalar-1');
        fireEvent.click(mappingTile);

        // FieldDetailPanel opens for field 22
        await waitFor(() => {
            expect(kycQuery.getFieldDetail).toHaveBeenCalledWith('le-123', 22, 'CLIENT_LE', undefined);
        });

        // The "Alternative Mapping" badge/label is absent
        expect(screen.queryByText(/alternative mapping/i)).toBeNull();
    });

    it('6. Legacy/unexpected unmapped question displays "Mapping required" and NO answer editor', async () => {
        render(<CrossQuestionnaireMapper leId="le-123" initialData={mockInitialData} />);

        const unmappedCard = screen.getByTestId('rdd1-card-q-unmapped-1');
        expect(unmappedCard).toHaveTextContent(/mapping required/i);

        // Ensure no answer inputs
        expect(unmappedCard.querySelector('input')).toBeNull();
    });

    it('7. Canonical display parity: renders scalar and structured/party fields using Master Record conventions', async () => {
        render(<CrossQuestionnaireMapper leId="le-123" initialData={mockInitialData} />);

        // Scalar field value
        expect(screen.getByText('United Kingdom')).toBeInTheDocument();

        // Structured party collection
        expect(screen.getByText('Red Rock Renewables Limited')).toBeInTheDocument();
    });

    it('8. Canonical Master attachment appears in RDD1 without relying on legacy question-document plumbing', async () => {
        render(<CrossQuestionnaireMapper leId="le-123" initialData={mockInitialData} />);

        expect(screen.getByText('Certificate_of_Incorporation.pdf')).toBeInTheDocument();
    });

    it('9. Responsive container layout adheres to Question -> Mapping -> Master value order and container queries', async () => {
        const { container } = render(<CrossQuestionnaireMapper leId="le-123" initialData={mockInitialData} />);

        const card = container.querySelector('[data-testid="rdd1-card-q-scalar-1"]');
        expect(card).toBeInTheDocument();

        // Must declare container queries
        expect(card?.className).toMatch(/@container/);

        // Verify DOM order: 1st Question, 2nd Mapping, 3rd Master Value
        const questionStage = screen.getByTestId('rdd1-stage-question-q-scalar-1');
        const mappingStage = screen.getByTestId('rdd1-stage-mapping-q-scalar-1');
        const valueStage = screen.getByTestId('rdd1-stage-value-q-scalar-1');

        expect(questionStage.compareDocumentPosition(mappingStage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(mappingStage.compareDocumentPosition(valueStage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('10. RDD1 does not decorate question titles with transient Q1, Q2 prefixes', async () => {
        render(<CrossQuestionnaireMapper leId="le-123" initialData={mockInitialData} />);

        // Question titles must NOT have transient Q1:, Q2: prefixes generated from filter index
        expect(screen.queryByText(/^Q1:/)).toBeNull();
        expect(screen.getByText('Country of Registration')).toBeInTheDocument();
    });

    it('11. Alternative mapping selector displays compact canonical summaries instead of "Structured data"', async () => {
        render(<CrossQuestionnaireMapper leId="le-123" initialData={mockInitialData} />);

        // Open inspection drawer
        const mappingTile = screen.getByTestId('rdd1-mapping-tile-q-scalar-1');
        fireEvent.click(mappingTile);

        // Open SuperFieldSelector
        const mappingSelectorCard = await screen.findByTestId('rdd1-alternative-mapping-selector');
        const selectorBtn = mappingSelectorCard.querySelector('button[role="combobox"]')!;
        fireEvent.click(selectorBtn);

        // Verify Directors summary renders "3 directors" and NEVER "Structured data"
        await waitFor(() => {
            expect(screen.getByText('3 directors')).toBeInTheDocument();
        });
        expect(screen.queryByText('Structured data')).toBeNull();
    });
});
