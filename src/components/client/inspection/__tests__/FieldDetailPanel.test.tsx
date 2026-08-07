/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
        vi.clearAllMocks();
    });

    it('renders FieldAttachments mode="manage" when allowAttachments is true', async () => {
        const mockData = {
            fieldNo: 123,
            current: { value: 'Test Value', source: 'TEST' },
            canonicalDisplayModel: {
                allowAttachments: true,
                attachments: [],
                isEditable: true,
                state: 'POPULATED',
                value: { kind: 'scalar', display: 'Test Value' }
            }
        };

        vi.mocked(kycQuery.getFieldDetail).mockResolvedValue(mockData as any);

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
        const mockData = {
            fieldNo: 123,
            current: { value: 'Test Value', source: 'TEST' },
            canonicalDisplayModel: {
                allowAttachments: true,
                attachments: [],
                isEditable: true,
                state: 'POPULATED',
                value: { kind: 'scalar', display: 'Test Value' }
            }
        };

        vi.mocked(kycQuery.getFieldDetail).mockResolvedValue(mockData as any);

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
        const mockData = {
            fieldNo: 123,
            current: { value: 'Test Value', source: 'TEST' },
            canonicalDisplayModel: {
                allowAttachments: false,
                attachments: [],
                isEditable: true,
                state: 'POPULATED',
                value: { kind: 'scalar', display: 'Test Value' }
            }
        };

        vi.mocked(kycQuery.getFieldDetail).mockResolvedValue(mockData as any);

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
});
