/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { FieldDetailPanel } from '../field-detail-panel';
import * as kycQuery from '@/actions/kyc-query';

// Mock the queries
vi.mock('@/actions/kyc-query', () => ({
    getFieldDetail: vi.fn(),
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
