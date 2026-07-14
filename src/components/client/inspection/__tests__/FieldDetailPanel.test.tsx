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
});
