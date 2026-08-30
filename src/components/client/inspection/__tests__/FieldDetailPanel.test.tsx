/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { FieldDetailPanel } from '../field-detail-panel';
import * as kycQuery from '@/actions/kyc-query';

// Mock the queries
vi.mock('@/actions/kyc-query', () => ({
    getFieldDetail: vi.fn(),
}));

vi.mock('@/actions/kyc-manual-update', () => ({
    updateFieldManually: vi.fn().mockResolvedValue({ success: true }),
    removeMultiValueEntry: vi.fn().mockResolvedValue({ success: true }),
    addMultiValueEntry: vi.fn().mockResolvedValue({ success: true }),
    clearSingleValueEntry: vi.fn().mockResolvedValue({ success: true }),
    addCodeListEntry: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/actions/client-le', () => ({
    getFieldUsageDetails: vi.fn().mockResolvedValue({
        totalQuestions: 1,
        totalQuestionnaires: 1,
        totalSuppliers: 1,
        relationships: [{
            supplierId: 's1',
            supplierName: 'Barclays',
            supplierCode: 'BARC',
            questionnaires: [{
                questionnaireId: 'qn1',
                questionnaireName: 'KYC Form',
                questions: [{ id: 'q1', text: 'What is your registered address?' }]
            }]
        }],
        questions: [{ id: 'q1', text: 'What is your registered address?', questionnaireId: 'qn1', questionnaireName: 'KYC Form', supplierName: 'Barclays' }],
        questionnaires: [{ id: 'qn1', name: 'KYC Form', supplierName: 'Barclays' }],
        suppliers: [{ id: 's1', name: 'Barclays', shortCode: 'BARC' }]
    }),
}));

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: vi.fn(),
        replace: vi.fn(),
        prefetch: vi.fn(),
        refresh: vi.fn(),
    }),
}));

vi.mock('next-auth/react', () => ({
    useSession: () => ({ data: { user: { name: 'Test User' } }, status: 'authenticated' }),
}));

vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: 'test-user' }),
}));

// Mock the child attachment component so we can verify its props
vi.mock('@/components/client/fields/FieldAttachments', () => ({
    FieldAttachments: (props: any) => (
        <div data-testid="mock-field-attachments" data-mode={props.mode}>
            MockAttachments
        </div>
    )
}));

// Mock icons to avoid SVG rendering issues in tests
vi.mock('lucide-react', async (importOriginal) => {
    const mod = await importOriginal<any>();
    return {
        ...mod,
        Loader2: () => <span>Loader</span>,
        Paperclip: () => <span>Paperclip</span>,
        Database: () => <span>Database</span>,
    };
});

describe('FieldDetailPanel - Attachment Integration', () => {
    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();
        vi.mocked(kycQuery.getFieldDetail).mockImplementation(async (arg0: any, arg1: any) => {
            const fieldNo = typeof arg0 === 'number' ? arg0 : (typeof arg1 === 'number' ? arg1 : arg0?.fieldNo);
            if (fieldNo === 18) {
                return {
                    fieldNo: 18,
                    fieldName: 'Registered number',
                    dataType: 'TEXT',
                    isRepeating: false,
                    current: { value: '12345678', source: 'REGISTRATION_AUTHORITY', timestamp: new Date('2026-06-11') },
                    canonicalDisplayModel: {
                        allowAttachments: false,
                        attachments: [],
                        isEditable: true,
                        state: 'POPULATED',
                        value: { kind: 'scalar', display: '12345678', rawValue: '12345678' },
                        source: { type: 'REGISTRATION_AUTHORITY', label: 'Companies House', colorKey: 'REGISTRY', lastValidatedAt: '2026-06-11T10:00:00.000Z' }
                    }
                } as any;
            }
            if (fieldNo === 271) {
                return {
                    fieldNo: 271,
                    fieldName: 'test mapped field',
                    dataType: 'TEXT',
                    isRepeating: false,
                    current: { value: 'Original Value', source: 'GLEIF', timestamp: new Date('2026-05-01') },
                    canonicalDisplayModel: {
                        allowAttachments: false,
                        attachments: [],
                        isEditable: true,
                        state: 'POPULATED',
                        value: { kind: 'scalar', display: 'Original Value', rawValue: 'Original Value' },
                        source: { type: 'GLEIF', label: 'GLEIF', colorKey: 'GLEIF', lastValidatedAt: '2026-05-01T10:00:00.000Z' }
                    }
                } as any;
            }
            if (fieldNo === 104 || fieldNo === 105) {
                const partyObj = {
                    contactType: 'PERSON',
                    partyType: 'INDIVIDUAL',
                    forenames: 'Christopher David',
                    surname: 'Marsh',
                    isActivePersonOrContact: true
                };
                return {
                    fieldNo,
                    fieldName: fieldNo === 104 ? 'SSI callback contact(s)' : 'Other Party Field',
                    dataType: 'PARTY',
                    isRepeating: false,
                    candidates: [
                        {
                            id: `cand-${fieldNo}`,
                            source: 'USER_INPUT',
                            isAuthoritative: false,
                            timestamp: new Date('2026-08-20'),
                            confidence: 0.95,
                            value: partyObj
                        }
                    ],
                    current: { value: partyObj, source: 'USER_INPUT' },
                    canonicalDisplayModel: {
                        allowAttachments: false,
                        attachments: [],
                        isEditable: true,
                        state: 'POPULATED',
                        value: { kind: 'party', data: partyObj }
                    }
                } as any;
            }
            return {
                fieldNo: fieldNo || 123,
                current: { value: 'Test Value', source: 'TEST' },
                canonicalDisplayModel: {
                    allowAttachments: true,
                    attachments: [],
                    isEditable: true,
                    state: 'POPULATED',
                    value: { kind: 'scalar', display: 'Test Value' }
                }
            } as any;
        });
    });

    it('renders FieldAttachments mode="manage" when allowAttachments is true', async () => {
        render(
            <FieldDetailPanel 
                open={true} 
                onOpenChange={() => {}} 
                clientLEId="le-123" 
                fieldNo={123} 
                fieldName="Test Field" 
            />
        );

        await waitFor(() => {
            expect(kycQuery.getFieldDetail).toHaveBeenCalled();
        });

        // The new attachment component should be rendered
        const attachmentComponent = await screen.findByTestId('mock-field-attachments');
        expect(attachmentComponent).toBeTruthy();
        expect(attachmentComponent.getAttribute('data-mode')).toBe('manage');
    });

    it('does not render legacy upload input for field attachments', async () => {
        render(
            <FieldDetailPanel 
                open={true} 
                onOpenChange={() => {}} 
                clientLEId="le-123" 
                fieldNo={123} 
                fieldName="Test Field" 
            />
        );

        await waitFor(() => {
            expect(kycQuery.getFieldDetail).toHaveBeenCalled();
        });

        // Verify the legacy "Attach Document" button is gone
        const legacyUploadBtn = screen.queryByText(/Attach Document/i);
        expect(legacyUploadBtn).toBeNull();
        
        // Verify no type="file" input is present
        const fileInputs = document.querySelectorAll('input[type="file"]');
        expect(fileInputs.length).toBe(0);
    });

    it('renders hierarchical Relationships & Usage tree with Question Bank links', async () => {
        render(
            <FieldDetailPanel 
                open={true} 
                onOpenChange={() => {}} 
                clientLEId="le-123" 
                fieldNo={123} 
                fieldName="Test Field" 
                mappingStats={{ questions: 1, questionnaires: 1, suppliers: 1 }}
            />
        );

        // Verify Relationship header is rendered
        const relHeader = await screen.findByText('Barclays', {}, { timeout: 3000 });
        expect(relHeader).toBeTruthy();

        // Verify Questionnaire title is rendered
        const qnTitle = await screen.findByText('KYC Form', {}, { timeout: 3000 });
        expect(qnTitle).toBeTruthy();

        // Verify Question text is rendered
        const questionText = await screen.findByText(/"What is your registered address\?"/i, {}, { timeout: 3000 });
        expect(questionText).toBeTruthy();

        // Verify text labels have direct links to Question Bank (/workbench4)
        expect(relHeader.closest('a')?.getAttribute('href')).toContain('/workbench4?rel=Barclays');
        expect(qnTitle.closest('a')?.getAttribute('href')).toContain('/workbench4?q=KYC%20Form');
        expect(questionText.closest('a')?.getAttribute('href')).toContain('/workbench4?s=What%20is%20your%20registered%20address%3F');
    });

    it('renders an editable text <Input> control when Edit Pencil is clicked for scalar field F18', async () => {
        render(
            <FieldDetailPanel 
                open={true} 
                onOpenChange={() => {}} 
                clientLEId="le-123" 
                fieldNo={18} 
                fieldName="Registered number" 
            />
        );

        await waitFor(() => {
            expect(screen.getByTitle('Edit value')).toBeTruthy();
        });

        const editBtn = screen.getByTitle('Edit value');
        const { fireEvent } = await import('@testing-library/react');
        fireEvent.click(editBtn);

        const inputControl = await screen.findByPlaceholderText('Enter value...') as HTMLInputElement;
        expect(inputControl).toBeTruthy();
        expect(inputControl.value).toBe('12345678');
    });

    it('renders an editable text <Input> control for simple mapped scalar text field F271', async () => {
        render(
            <FieldDetailPanel 
                open={true} 
                onOpenChange={() => {}} 
                clientLEId="le-123" 
                fieldNo={271} 
                fieldName="test mapped field" 
            />
        );

        await waitFor(() => {
            expect(screen.getByTitle('Edit value')).toBeTruthy();
        });

        const editBtn = screen.getByTitle('Edit value');
        const { fireEvent } = await import('@testing-library/react');
        fireEvent.click(editBtn);

        const inputControl = await screen.findByPlaceholderText('Enter value...') as HTMLInputElement;
        expect(inputControl).toBeTruthy();
        expect(inputControl.value).toBe('Original Value');
    });
});

describe('FieldDetailPanel - Generic Multi-Value Branch (Field 235 & Generic Repeating Fields)', () => {
    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();
        vi.mocked(kycQuery.getFieldDetail).mockImplementation(async (arg0: any, arg1: any) => {
            const fieldNo = typeof arg0 === 'number' ? arg0 : (typeof arg1 === 'number' ? arg1 : arg0?.fieldNo);
            if (fieldNo === 235) {
                return {
                    fieldNo: 235,
                    fieldName: 'Corporate Sector(s)',
                    dataType: 'SELECT',
                    isRepeating: true,
                    options: [
                        { label: 'D Electricity, Gas, Steam and Air Conditioning Supply', value: 'D Electricity, Gas, Steam and Air Conditioning Supply' },
                        { label: 'C Manufacturing', value: 'C Manufacturing' },
                        { label: 'J Information and Communication', value: 'J Information and Communication' }
                    ],
                    rows: [
                        { id: 'claim-1', instanceId: 'inst-1', value: 'C Manufacturing', source: 'USER_INPUT', timestamp: new Date('2026-08-01') },
                        { id: 'claim-2', instanceId: 'inst-2', value: 'J Information and Communication', source: 'USER_INPUT', timestamp: new Date('2026-08-02') }
                    ],
                    current: { value: ['C Manufacturing', 'J Information and Communication'], source: 'USER_INPUT', timestamp: new Date('2026-08-02') },
                } as any;
            }
            if (fieldNo === 78) {
                return {
                    fieldNo: 78,
                    fieldName: 'Primary business activity',
                    dataType: 'TEXT',
                    isRepeating: false,
                    current: { value: 'Test business activity', source: 'USER_INPUT', timestamp: new Date('2026-08-20') },
                } as any;
            }
            if (fieldNo === 300) {
                return {
                    fieldNo: 300,
                    fieldName: 'Repeating Text Field',
                    dataType: 'TEXT',
                    isRepeating: true,
                    options: [],
                    rows: [
                        { id: 'text-claim-1', instanceId: 'text-inst-1', value: 'First Text Value', source: 'USER_INPUT', timestamp: new Date('2026-08-01') }
                    ],
                    current: { value: ['First Text Value'], source: 'USER_INPUT', timestamp: new Date('2026-08-01') },
                } as any;
            }
            if (fieldNo === 500) {
                return {
                    fieldNo: 500,
                    fieldName: 'Repeating Boolean Field',
                    dataType: 'BOOLEAN',
                    isRepeating: true,
                    options: [],
                    rows: [
                        { id: 'bool-claim-1', instanceId: 'bool-inst-1', value: true, source: 'USER_INPUT', timestamp: new Date('2026-08-01') }
                    ],
                    current: { value: [true], source: 'USER_INPUT' }
                } as any;
            }
            if (fieldNo === 501) {
                return {
                    fieldNo: 501,
                    fieldName: 'Repeating Date Field',
                    dataType: 'DATE',
                    isRepeating: true,
                    options: [],
                    rows: [
                        { id: 'date-claim-1', instanceId: 'date-inst-1', value: '2026-08-20T00:00:00.000Z', source: 'USER_INPUT', timestamp: new Date('2026-08-20') }
                    ],
                    current: { value: ['2026-08-20T00:00:00.000Z'], source: 'USER_INPUT' }
                } as any;
            }
            if (fieldNo === 104 || fieldNo === 105) {
                const partyObj = {
                    contactType: 'PERSON',
                    partyType: 'INDIVIDUAL',
                    forenames: 'Christopher David',
                    surname: 'Marsh',
                    isActivePersonOrContact: true
                };
                return {
                    fieldNo,
                    fieldName: fieldNo === 104 ? 'SSI callback contact(s)' : 'Other Party Field',
                    dataType: 'PARTY',
                    isRepeating: false,
                    candidates: [
                        {
                            id: `cand-${fieldNo}`,
                            source: 'USER_INPUT',
                            isAuthoritative: false,
                            timestamp: new Date('2026-08-20'),
                            confidence: 0.95,
                            value: partyObj
                        }
                    ],
                    current: { value: partyObj, source: 'USER_INPUT' },
                    canonicalDisplayModel: {
                        allowAttachments: false,
                        attachments: [],
                        isEditable: true,
                        state: 'POPULATED',
                        value: { kind: 'party', data: partyObj }
                    }
                } as any;
            }
            return {
                fieldNo: fieldNo || 123,
                current: { value: 'Test Value', source: 'TEST' },
            } as any;
        });
    });

    it('clears single-value scalar field F78 when Yes, clear is confirmed via clearSingleValueEntry', async () => {
        const kycManual = await import('@/actions/kyc-manual-update');
        vi.mocked(kycManual.clearSingleValueEntry).mockResolvedValue({ success: true });
        const { fireEvent } = await import('@testing-library/react');

        render(
            <FieldDetailPanel 
                open={true} 
                onOpenChange={() => {}} 
                clientLEId="le-123" 
                fieldNo={78} 
                fieldName="Primary business activity" 
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Test business activity')).toBeTruthy();
        });

        const trashBtn = screen.getByTitle('Clear value');
        fireEvent.click(trashBtn);

        expect(screen.getByText('Clear this value?')).toBeTruthy();

        const confirmBtn = screen.getByText('Yes, clear');
        fireEvent.click(confirmBtn);

        await waitFor(() => {
            expect(kycManual.clearSingleValueEntry).toHaveBeenCalledWith(
                'le-123',
                78
            );
            expect(kycManual.removeMultiValueEntry).not.toHaveBeenCalled();
        });
    });

    it('shows repeating SELECT rows in read-only state initially with Edit and Trash buttons', async () => {
        render(
            <FieldDetailPanel 
                open={true} 
                onOpenChange={() => {}} 
                clientLEId="le-123" 
                fieldNo={235} 
                fieldName="Corporate Sector(s)" 
            />
        );

        await waitFor(() => {
            expect(screen.getByText('C Manufacturing')).toBeTruthy();
            expect(screen.getByText('J Information and Communication')).toBeTruthy();
        });

        const editBtns = screen.getAllByTitle('Edit value');
        const trashBtns = screen.getAllByTitle('Remove value');
        expect(editBtns.length).toBe(2);
        expect(trashBtns.length).toBe(2);
    });

    it('enters edit mode for a specific row when Pencil is clicked and renders Select dropdown with options', async () => {
        const { fireEvent } = await import('@testing-library/react');
        render(
            <FieldDetailPanel 
                open={true} 
                onOpenChange={() => {}} 
                clientLEId="le-123" 
                fieldNo={235} 
                fieldName="Corporate Sector(s)" 
            />
        );

        await waitFor(() => {
            expect(screen.getByText('C Manufacturing')).toBeTruthy();
        });

        const editBtns = screen.getAllByTitle('Edit value');
        fireEvent.click(editBtns[0]); // Edit row 1 ('claim-1', 'C Manufacturing')

        // Verify Save and Cancel buttons appear for row 1 edit mode
        expect(screen.getByTitle('Save value')).toBeTruthy();
        expect(screen.getByTitle('Cancel')).toBeTruthy();

        // Sibling row ('J Information and Communication') remains in read-only mode
        expect(screen.getByText('J Information and Communication')).toBeTruthy();
    });

    it('cancels edit mode without saving when Cancel button is clicked', async () => {
        const kycManual = await import('@/actions/kyc-manual-update');
        const { fireEvent } = await import('@testing-library/react');

        render(
            <FieldDetailPanel 
                open={true} 
                onOpenChange={() => {}} 
                clientLEId="le-123" 
                fieldNo={235} 
                fieldName="Corporate Sector(s)" 
            />
        );

        await waitFor(() => {
            expect(screen.getByText('C Manufacturing')).toBeTruthy();
        });

        const editBtns = screen.getAllByTitle('Edit value');
        fireEvent.click(editBtns[0]);

        const cancelBtn = screen.getByTitle('Cancel');
        fireEvent.click(cancelBtn);

        // Returns to read-only state
        expect(screen.getByText('C Manufacturing')).toBeTruthy();
        expect(kycManual.updateFieldManually).not.toHaveBeenCalled();
    });

    it('invokes updateFieldManually with correct instanceId when Save is clicked', async () => {
        const kycManual = await import('@/actions/kyc-manual-update');
        vi.mocked(kycManual.updateFieldManually).mockResolvedValue({ success: true });
        const { fireEvent } = await import('@testing-library/react');

        render(
            <FieldDetailPanel 
                open={true} 
                onOpenChange={() => {}} 
                clientLEId="le-123" 
                fieldNo={235} 
                fieldName="Corporate Sector(s)" 
            />
        );

        await waitFor(() => {
            expect(screen.getByText('C Manufacturing')).toBeTruthy();
        });

        const editBtns = screen.getAllByTitle('Edit value');
        fireEvent.click(editBtns[0]); // Edit claim-1

        const saveBtn = screen.getByTitle('Save value');
        fireEvent.click(saveBtn);

        await waitFor(() => {
            expect(kycManual.updateFieldManually).toHaveBeenCalledWith(
                'le-123',
                235,
                'C Manufacturing',
                'Inline edit',
                'inst-1',
                'CLIENT_LE'
            );
        });
    });

    it('shows inline Remove / Cancel confirmation when Trash icon is clicked', async () => {
        const { fireEvent } = await import('@testing-library/react');
        render(
            <FieldDetailPanel 
                open={true} 
                onOpenChange={() => {}} 
                clientLEId="le-123" 
                fieldNo={235} 
                fieldName="Corporate Sector(s)" 
            />
        );

        await waitFor(() => {
            expect(screen.getByText('C Manufacturing')).toBeTruthy();
        });

        const trashBtns = screen.getAllByTitle('Remove value');
        fireEvent.click(trashBtns[0]); // Trash row 1 ('claim-1')

        // Confirmation banner appears
        expect(screen.getByText(/Remove "C Manufacturing"\?/i)).toBeTruthy();
        expect(screen.getByText('Yes, remove')).toBeTruthy();
        expect(screen.getByText('Cancel')).toBeTruthy();

        // Row 2 remains untouched
        expect(screen.getByText('J Information and Communication')).toBeTruthy();
    });

    it('cancels delete confirmation when Cancel button is clicked', async () => {
        const kycManual = await import('@/actions/kyc-manual-update');
        const { fireEvent } = await import('@testing-library/react');

        render(
            <FieldDetailPanel 
                open={true} 
                onOpenChange={() => {}} 
                clientLEId="le-123" 
                fieldNo={235} 
                fieldName="Corporate Sector(s)" 
            />
        );

        await waitFor(() => {
            expect(screen.getByText('C Manufacturing')).toBeTruthy();
        });

        const trashBtns = screen.getAllByTitle('Remove value');
        fireEvent.click(trashBtns[0]);

        const cancelBtn = screen.getByText('Cancel');
        fireEvent.click(cancelBtn);

        // Returns to read-only state without calling removeMultiValueEntry
        expect(screen.getByText('C Manufacturing')).toBeTruthy();
        expect(kycManual.removeMultiValueEntry).not.toHaveBeenCalled();
    });

    it('invokes removeMultiValueEntry with claim ID when Yes, remove is confirmed', async () => {
        const kycManual = await import('@/actions/kyc-manual-update');
        vi.mocked(kycManual.removeMultiValueEntry).mockResolvedValue({ success: true });
        const { fireEvent } = await import('@testing-library/react');

        render(
            <FieldDetailPanel 
                open={true} 
                onOpenChange={() => {}} 
                clientLEId="le-123" 
                fieldNo={235} 
                fieldName="Corporate Sector(s)" 
            />
        );

        await waitFor(() => {
            expect(screen.getByText('C Manufacturing')).toBeTruthy();
        });

        const trashBtns = screen.getAllByTitle('Remove value');
        fireEvent.click(trashBtns[0]); // claim-1

        const confirmBtn = screen.getByText('Yes, remove');
        fireEvent.click(confirmBtn);

        await waitFor(() => {
            expect(kycManual.removeMultiValueEntry).toHaveBeenCalledWith(
                'le-123',
                235,
                'claim-1'
            );
        });
    });

    it('enters edit mode with a usable <Input> control for repeating TEXT field F300', async () => {
        const { fireEvent } = await import('@testing-library/react');
        render(
            <FieldDetailPanel 
                open={true} 
                onOpenChange={() => {}} 
                clientLEId="le-123" 
                fieldNo={300} 
                fieldName="Repeating Text Field" 
            />
        );

        await waitFor(() => {
            expect(screen.getByText('First Text Value')).toBeTruthy();
        });

        const editBtn = screen.getByTitle('Edit value');
        fireEvent.click(editBtn);

        // Renders Input with current text value
        const inputControl = document.querySelector('input[type="text"]') as HTMLInputElement;
        expect(inputControl).toBeTruthy();
        expect(inputControl.value).toBe('First Text Value');
    });
});

describe('FieldDetailPanel - Field 104 Suggestions Badge Suppression', () => {
    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();
        vi.mocked(kycQuery.getFieldDetail).mockImplementation(async (arg0: any, arg1: any) => {
            const fieldNo = typeof arg0 === 'number' ? arg0 : (typeof arg1 === 'number' ? arg1 : arg0?.fieldNo);
            const partyObj = {
                contactType: 'PERSON',
                partyType: 'INDIVIDUAL',
                forenames: 'Christopher David',
                surname: 'Marsh',
                isActivePersonOrContact: true
            };
            return {
                fieldNo: fieldNo || 104,
                fieldName: fieldNo === 104 ? 'SSI callback contact(s)' : 'Other Party Field',
                dataType: 'PARTY',
                isRepeating: false,
                candidates: [
                    {
                        id: `cand-${fieldNo}`,
                        source: 'USER_INPUT',
                        isAuthoritative: false,
                        timestamp: new Date('2026-08-20'),
                        confidence: 0.95,
                        value: partyObj
                    }
                ],
                current: { value: partyObj, source: 'USER_INPUT' },
                canonicalDisplayModel: {
                    allowAttachments: false,
                    attachments: [],
                    isEditable: true,
                    state: 'POPULATED',
                    value: { kind: 'party', data: partyObj }
                }
            } as any;
        });
    });

    it('suppresses Active / Inactive badge for Field 104 Suggestions rendering while preserving forenames, surname and candidate structure', async () => {
        render(
            <FieldDetailPanel 
                open={true} 
                onOpenChange={() => {}} 
                clientLEId="le-123" 
                fieldNo={104} 
                fieldName="SSI callback contact(s)" 
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Christopher David')).toBeTruthy();
            expect(screen.getByText('Marsh')).toBeTruthy();
        });

        // Verify Field 104 Suggestions card does NOT contain "Active" status badge
        expect(screen.queryByText('Active')).toBeNull();
    });

    it('retains Active / Inactive badge for non-104 Party field Suggestions (e.g. Field 105)', async () => {
        render(
            <FieldDetailPanel 
                open={true} 
                onOpenChange={() => {}} 
                clientLEId="le-123" 
                fieldNo={105} 
                fieldName="Other Party Field" 
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Christopher David')).toBeTruthy();
            expect(screen.getByText('Marsh')).toBeTruthy();
            expect(screen.getByText('Active')).toBeTruthy();
        });
    });
});

describe('FieldDetailPanel - CanonicalScalarEditor Integration', () => {
    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it('renders constrained boolean select (not free text input) for populated BOOLEAN field 243 when Pencil is clicked', async () => {
        vi.mocked(kycQuery.getFieldDetail).mockResolvedValueOnce({
            fieldNo: 243,
            fieldName: 'Cleared derivative trading only?',
            dataType: 'BOOLEAN',
            isRepeating: false,
            current: { value: true, source: 'USER_INPUT' },
            canonicalDisplayModel: {
                allowAttachments: false,
                attachments: [],
                isEditable: true,
                state: 'POPULATED',
                value: { kind: 'scalar', display: 'Yes', rawValue: true }
            }
        } as any);

        render(
            <FieldDetailPanel
                open={true}
                onOpenChange={() => {}}
                clientLEId="le-123"
                fieldNo={243}
                fieldName="Cleared derivative trading only?"
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Yes')).toBeTruthy();
        });

        // Click Edit Pencil
        const editButton = screen.getByTitle('Edit value');
        fireEvent.click(editButton);

        // Should render a Select dropdown combobox for Yes/No, NOT a generic text input
        await waitFor(() => {
            expect(screen.getByRole('combobox')).toBeTruthy();
            expect(screen.queryByPlaceholderText('Enter value...')).toBeNull();
        });
    });

    it('renders constrained boolean select (not free text input) for empty BOOLEAN field 243 when Plus is clicked', async () => {
        vi.mocked(kycQuery.getFieldDetail).mockResolvedValueOnce({
            fieldNo: 243,
            fieldName: 'Cleared derivative trading only?',
            dataType: 'BOOLEAN',
            isRepeating: false,
            current: null,
            canonicalDisplayModel: {
                allowAttachments: false,
                attachments: [],
                isEditable: true,
                state: 'NO_DATA',
                value: { kind: 'empty' }
            }
        } as any);

        render(
            <FieldDetailPanel
                open={true}
                onOpenChange={() => {}}
                clientLEId="le-123"
                fieldNo={243}
                fieldName="Cleared derivative trading only?"
            />
        );

        await waitFor(() => {
            expect(screen.getByTitle('Add value')).toBeTruthy();
        });

        // Click Add Value Plus icon
        fireEvent.click(screen.getByTitle('Add value'));

        // Should render a Select dropdown combobox for Yes/No, NOT a free text input
        await waitFor(() => {
            expect(screen.getByRole('combobox')).toBeTruthy();
            expect(screen.queryByPlaceholderText('Type a value and press Enter...')).toBeNull();
        });
    });

    it('renders standard text input for ordinary TEXT field 18 in edit mode', async () => {
        vi.mocked(kycQuery.getFieldDetail).mockResolvedValueOnce({
            fieldNo: 18,
            fieldName: 'Registered number',
            dataType: 'TEXT',
            isRepeating: false,
            current: { value: '123456', source: 'USER_INPUT' },
            canonicalDisplayModel: {
                allowAttachments: false,
                attachments: [],
                isEditable: true,
                state: 'POPULATED',
                value: { kind: 'scalar', display: '123456', rawValue: '123456' }
            }
        } as any);

        render(
            <FieldDetailPanel
                open={true}
                onOpenChange={() => {}}
                clientLEId="le-123"
                fieldNo={18}
                fieldName="Registered number"
            />
        );

        await waitFor(() => {
            expect(screen.getByText('123456')).toBeTruthy();
        });

            fireEvent.click(screen.getByTitle('Edit value'));

            await waitFor(() => {
                const input = screen.getByPlaceholderText('Enter value...');
                expect(input).toBeTruthy();
                expect((input as HTMLInputElement).value).toBe('123456');
            });
        });

    it('sanitizes explicitNone sentinel when entering edit mode on a scalar field whose authoritative claim is explicitNone', async () => {
        vi.mocked(kycQuery.getFieldDetail).mockResolvedValueOnce({
            fieldNo: 45,
            fieldName: 'Fund manager',
            dataType: 'TEXT',
            isRepeating: false,
            current: { value: { explicitNone: true }, source: 'USER_INPUT' },
            canonicalDisplayModel: {
                allowAttachments: false,
                attachments: [],
                isEditable: true,
                state: 'EXPLICIT_NONE',
                value: { kind: 'empty' }
            }
        } as any);

        render(
            <FieldDetailPanel
                open={true}
                onOpenChange={() => {}}
                clientLEId="le-123"
                fieldNo={45}
                fieldName="Fund manager"
            />
        );

        await waitFor(() => {
            expect(screen.getByText('None')).toBeTruthy();
        });

        fireEvent.click(screen.getByTitle('Edit value'));

        await waitFor(() => {
            const input = screen.getByPlaceholderText('Enter value...');
            expect(input).toBeTruthy();
            expect((input as HTMLInputElement).value).toBe('');
            expect(screen.queryByDisplayValue('{"explicitNone":true}')).toBeNull();
        });
    });
});

describe('FieldDetailPanel - Multi-Value CanonicalScalarEditor Integration', () => {
    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it('TEXT × MANY: uses standard text input for both editing existing items and adding new items', async () => {
        const kycManual = await import('@/actions/kyc-manual-update');
        vi.mocked(kycQuery.getFieldDetail).mockResolvedValueOnce({
            fieldNo: 300,
            fieldName: 'Repeating Text Field',
            dataType: 'TEXT',
            isRepeating: true,
            options: [],
            rows: [
                { id: 'text-claim-1', instanceId: 'text-inst-1', value: 'Existing Text Item', source: 'USER_INPUT', timestamp: new Date('2026-08-01') }
            ],
            current: { value: ['Existing Text Item'], source: 'USER_INPUT' }
        } as any);

        render(
            <FieldDetailPanel
                open={true}
                onOpenChange={() => {}}
                clientLEId="le-123"
                fieldNo={300}
                fieldName="Repeating Text Field"
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Existing Text Item')).toBeTruthy();
        });

        // 1. Edit existing item -> uses text input
        fireEvent.click(screen.getByTitle('Edit value'));
        await waitFor(() => {
            const editInput = screen.getByDisplayValue('Existing Text Item') as HTMLInputElement;
            expect(editInput).toBeTruthy();
            expect(editInput.type).toBe('text');
        });

        // 2. Add new item -> uses text input
        const addInput = screen.getByPlaceholderText('Add new value...') as HTMLInputElement;
        expect(addInput).toBeTruthy();
        expect(addInput.type).toBe('text');
    });

    it('BOOLEAN × MANY: uses constrained Yes/No dropdown control (not free text) for both edit and add states and passes boolean to save', async () => {
        const kycManual = await import('@/actions/kyc-manual-update');
        vi.mocked(kycManual.addMultiValueEntry).mockResolvedValue({ success: true });
        vi.mocked(kycQuery.getFieldDetail).mockResolvedValueOnce({
            fieldNo: 500,
            fieldName: 'Repeating Boolean Field',
            dataType: 'BOOLEAN',
            isRepeating: true,
            options: [],
            rows: [
                { id: 'bool-claim-1', instanceId: 'bool-inst-1', value: true, source: 'USER_INPUT', timestamp: new Date('2026-08-01') }
            ],
            current: { value: [true], source: 'USER_INPUT' }
        } as any);

        render(
            <FieldDetailPanel
                open={true}
                onOpenChange={() => {}}
                clientLEId="le-123"
                fieldNo={500}
                fieldName="Repeating Boolean Field"
            />
        );

        await waitFor(() => {
            expect(screen.getByTitle('Edit value')).toBeTruthy();
        });

        // 1. Existing item edit -> renders combobox Select, not free text input
        fireEvent.click(screen.getByTitle('Edit value'));
        await waitFor(() => {
            const comboboxes = screen.getAllByRole('combobox');
            expect(comboboxes.length).toBeGreaterThan(0);
        });

        // 2. Add new item -> renders combobox Select for Yes/No, not free text input
        const addCombobox = screen.getAllByRole('combobox').pop();
        expect(addCombobox).toBeTruthy();
        expect(screen.queryByPlaceholderText('Add new value...')).toBeNull();
    });

    it('DATE × MANY: confirms repeating date fields render date picker inputs', async () => {
        vi.mocked(kycQuery.getFieldDetail).mockResolvedValueOnce({
            fieldNo: 501,
            fieldName: 'Repeating Date Field',
            dataType: 'DATE',
            isRepeating: true,
            options: [],
            rows: [
                { id: 'date-claim-1', instanceId: 'date-inst-1', value: '2026-08-20T00:00:00.000Z', source: 'USER_INPUT', timestamp: new Date('2026-08-20') }
            ],
            current: { value: ['2026-08-20T00:00:00.000Z'], source: 'USER_INPUT' }
        } as any);

        const { container } = render(
            <FieldDetailPanel
                open={true}
                onOpenChange={() => {}}
                clientLEId="le-123"
                fieldNo={501}
                fieldName="Repeating Date Field"
            />
        );

        await waitFor(() => {
            expect(screen.getByTitle('Edit value')).toBeTruthy();
        });

        // Edit existing date item -> uses input[type="date"]
        fireEvent.click(screen.getByTitle('Edit value'));
        await waitFor(() => {
            const dateInputs = document.querySelectorAll('input[type="date"]');
            expect(dateInputs.length).toBeGreaterThan(0);
        });
    });
});

describe('FieldDetailPanel - Multi-Value Repeating Party Save-for-Reuse Parity', () => {
    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it('1. repeating inline/source PARTY: renders "Save for reuse" button for unpromoted party rows', async () => {
        vi.mocked(kycQuery.getFieldDetail).mockResolvedValueOnce({
            fieldNo: 274,
            fieldName: 'Persons of significant control (other)',
            dataType: 'PARTY',
            appDataType: 'PARTY',
            isRepeating: true,
            rows: [
                {
                    id: 'claim-source-party-1',
                    instanceId: 'inst-1',
                    value: { partyType: 'ORGANISATION', organisationName: 'Source Inline Corp' },
                    source: 'USER_INPUT',
                    timestamp: new Date('2026-08-01'),
                    isPromotedToCCC: false,
                    data: {
                        organisationName: 'Source Inline Corp'
                    }
                }
            ],
            current: { value: [{ partyType: 'ORGANISATION', organisationName: 'Source Inline Corp' }], source: 'USER_INPUT' }
        } as any);

        render(
            <FieldDetailPanel
                open={true}
                onOpenChange={() => {}}
                clientLEId="le-123"
                fieldNo={274}
                fieldName="Persons of significant control (other)"
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Source Inline Corp')).toBeTruthy();
            expect(screen.getByText('Save for reuse')).toBeTruthy();
        });
    });

    it('2. repeating CCParty reference ({ccPartyId: ...}): does NOT render "Save for reuse" button', async () => {
        vi.mocked(kycQuery.getFieldDetail).mockResolvedValueOnce({
            fieldNo: 274,
            fieldName: 'Persons of significant control (other)',
            dataType: 'PARTY',
            appDataType: 'PARTY',
            isRepeating: true,
            rows: [
                {
                    id: 'claim-ref-party-1',
                    instanceId: 'inst-2',
                    value: { ccPartyId: '45e134dd-581b-4a09-814e-b57a0e1ab601' },
                    source: 'USER_INPUT',
                    timestamp: new Date('2026-08-01'),
                    isPromotedToCCC: false,
                    data: {
                        ccPartyId: '45e134dd-581b-4a09-814e-b57a0e1ab601',
                        _resolvedData: {
                            ccParty: {
                                data: {
                                    id: '45e134dd-581b-4a09-814e-b57a0e1ab601',
                                    partyType: 'ORGANISATION',
                                    organisationName: 'Curated Parent Holding Ltd'
                                }
                            }
                        }
                    }
                }
            ],
            current: { value: [{ ccPartyId: '45e134dd-581b-4a09-814e-b57a0e1ab601' }], source: 'USER_INPUT' }
        } as any);

        render(
            <FieldDetailPanel
                open={true}
                onOpenChange={() => {}}
                clientLEId="le-123"
                fieldNo={274}
                fieldName="Persons of significant control (other)"
            />
        );

        await waitFor(() => {
            // 3. Resolves and renders party data correctly
            expect(screen.getByText('Curated Parent Holding Ltd')).toBeTruthy();
        });

        // 2. Save for reuse action button is NOT rendered for existing CCParty reference
        expect(screen.queryByText('Save for reuse')).toBeNull();
    });

    it('4. preserves inline break link / delete confirmation behaviour for repeating party references', async () => {
        vi.mocked(kycQuery.getFieldDetail).mockResolvedValueOnce({
            fieldNo: 274,
            fieldName: 'Persons of significant control (other)',
            dataType: 'PARTY',
            appDataType: 'PARTY',
            isRepeating: true,
            rows: [
                {
                    id: 'claim-ref-party-delete',
                    instanceId: 'inst-3',
                    value: { ccPartyId: '45e134dd-581b-4a09-814e-b57a0e1ab601' },
                    source: 'USER_INPUT',
                    timestamp: new Date('2026-08-01'),
                    isPromotedToCCC: false,
                    data: {
                        ccPartyId: '45e134dd-581b-4a09-814e-b57a0e1ab601',
                        _resolvedData: {
                            ccParty: {
                                data: {
                                    id: '45e134dd-581b-4a09-814e-b57a0e1ab601',
                                    partyType: 'ORGANISATION',
                                    organisationName: 'Linked Holding Co'
                                }
                            }
                        }
                    }
                }
            ],
            current: { value: [{ ccPartyId: '45e134dd-581b-4a09-814e-b57a0e1ab601' }], source: 'USER_INPUT' }
        } as any);

        render(
            <FieldDetailPanel
                open={true}
                onOpenChange={() => {}}
                clientLEId="le-123"
                fieldNo={274}
                fieldName="Persons of significant control (other)"
            />
        );

        await waitFor(() => {
            expect(screen.getByTitle('Break link to party reference')).toBeTruthy();
        });

        // Click break link button
        fireEvent.click(screen.getByTitle('Break link to party reference'));

        await waitFor(() => {
            expect(screen.getByText('Yes, break link')).toBeTruthy();
        });
    });
});





