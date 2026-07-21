/**
 * @vitest-environment happy-dom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FieldAttachments } from '../FieldAttachments';
import { ResolvedAttachment } from '@/lib/master-data/field-display-model';
import * as blobClient from '@vercel/blob/client';
import * as attachmentActions from '@/actions/attachment-actions';
import * as uploadIntent from '@/actions/upload-intent';
import { listLibraryDocumentsAction } from '@/actions/document-library-actions';
import { toast } from 'sonner';

if (typeof window !== 'undefined' && typeof window.PointerEvent === 'undefined') {
    class PointerEvent extends Event {
        pointerId = 1;
        constructor(type: string, params: any = {}) {
            super(type, params);
        }
    }
    (window as any).PointerEvent = PointerEvent;
    window.HTMLElement.prototype.hasPointerCapture = () => false;
    window.HTMLElement.prototype.setPointerCapture = () => {};
    window.HTMLElement.prototype.releasePointerCapture = () => {};
}

vi.mock('@vercel/blob/client', () => ({
    upload: vi.fn()
}));
vi.mock('@/actions/attachment-actions', () => ({
    addFieldAttachment: vi.fn(),
    replaceFieldAttachment: vi.fn(),
    removeFieldAttachment: vi.fn()
}));
vi.mock('@/actions/upload-intent', () => ({
    getUploadIntentStatus: vi.fn()
}));
vi.mock('@/actions/document-library-actions', () => ({
    listLibraryDocumentsAction: vi.fn()
}));
vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn()
    }
}));
vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh: vi.fn() })
}));
global.crypto.randomUUID = () => 'test-uuid-1234';

const mockAttachment: ResolvedAttachment = {
    documentId: 'doc-1',
    displayName: 'Test Doc.pdf',
    mimeType: 'application/pdf',
    sizeBytes: '1024',
    lifecycleCreatedAt: '2023-01-01T00:00:00Z',
    currentDocumentCreatedAt: '2023-01-01T00:00:00Z',
    provenance: [{
        type: "FIELD",
        fieldNo: 1,
        fieldAttachmentInstanceId: "inst-1"
    }]
};

describe('FieldAttachments UI', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        // Restore default mocks that were previously setup globally
        vi.mocked(uploadIntent.getUploadIntentStatus).mockResolvedValue({ status: 'pending' } as any);
        // Ensure randomUUID is still there
        global.crypto.randomUUID = () => 'test-uuid-1234';
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });

    it('shows Add control only in manage mode and when editable', () => {
        const { rerender } = render(<FieldAttachments clientLEId="le-1" fieldNo={1} attachments={[]} isEditable={true} mode="manage" />);
        expect(screen.getByText('Add attachment')).toBeInTheDocument();

        rerender(<FieldAttachments clientLEId="le-1" fieldNo={1} attachments={[]} isEditable={false} mode="manage" />);
        expect(screen.queryByText('Add attachment')).not.toBeInTheDocument();

        rerender(<FieldAttachments clientLEId="le-1" fieldNo={1} attachments={[]} isEditable={true} mode="read-only" />);
        expect(screen.queryByText('Add attachment')).not.toBeInTheDocument();
    });

    it('shows Replace and Remove in manage mode for existing attachments', () => {
        render(<FieldAttachments clientLEId="le-1" fieldNo={1} attachments={[mockAttachment]} isEditable={true} mode="manage" />);
        expect(screen.getByRole('button', { name: /Replace attachment/i })).toBeInTheDocument();
        expect(screen.getByTitle('Remove attachment')).toBeInTheDocument();
    });

    it('read-only mode never shows mutation controls', () => {
        render(<FieldAttachments clientLEId="le-1" fieldNo={1} attachments={[mockAttachment]} isEditable={true} mode="read-only" />);
        expect(screen.queryByTitle('Replace attachment')).not.toBeInTheDocument();
        expect(screen.queryByTitle('Remove attachment')).not.toBeInTheDocument();
        expect(screen.queryByText('Attach Document')).not.toBeInTheDocument();
    });

    it('renders PARTY-only attachment with download but no Remove/Replace', () => {
        const partyAttachment: ResolvedAttachment = {
            documentId: 'doc-party',
            displayName: 'Party Doc.pdf',
            mimeType: 'application/pdf',
            sizeBytes: '2048',
            lifecycleCreatedAt: '2023-01-01T00:00:00Z',
            currentDocumentCreatedAt: '2023-01-01T00:00:00Z',
            provenance: [{ type: 'PARTY', partyId: 'p1', partyName: 'John Doe', partyDocumentInstanceId: 'inst-p1' }]
        };

        render(<FieldAttachments clientLEId="le-1" fieldNo={1} attachments={[partyAttachment]} isEditable={true} mode="manage" />);

        expect(screen.getByText('Attached to Party: John Doe')).toBeInTheDocument();
        expect(screen.getByTitle('Download')).toBeInTheDocument();
        expect(screen.queryByTitle('Replace attachment')).not.toBeInTheDocument();
        expect(screen.queryByTitle('Remove attachment')).not.toBeInTheDocument();
    });

    it('indicator mode shows correct valid count and hides if zero', () => {
        const { rerender, container } = render(<FieldAttachments clientLEId="le-1" fieldNo={1} attachments={[mockAttachment, mockAttachment]} isEditable={true} mode="indicator" />);
        expect(screen.getByTitle('2 attachments')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();

        rerender(<FieldAttachments clientLEId="le-1" fieldNo={1} attachments={[]} isEditable={true} mode="indicator" />);
        expect(container.firstChild).toBeNull();
    });

    it('validates file size and type', async () => {
        render(<FieldAttachments clientLEId="le-1" fieldNo={1} attachments={[]} isEditable={true} mode="manage" />);
        
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        const oversizedFile = new File([''], 'big.txt', { type: 'text/plain' });
        Object.defineProperty(oversizedFile, 'size', { value: 21 * 1024 * 1024 });
        
        fireEvent.change(fileInput, { target: { files: [oversizedFile] } });
        expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('20MB limit'));

        const invalidTypeFile = new File([''], 'bad.exe', { type: 'application/x-msdownload' });
        fireEvent.change(fileInput, { target: { files: [invalidTypeFile] } });
        expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('not supported'));
    });

    it('performs Replace flow with proper instanceId', async () => {
        vi.mocked(blobClient.upload).mockResolvedValueOnce({} as any);
        vi.mocked(uploadIntent.getUploadIntentStatus).mockResolvedValueOnce({
            status: 'completed',
            attachment: { ...mockAttachment, documentId: 'new-doc-2' }
        });

        render(<FieldAttachments clientLEId="le-1" fieldNo={1} attachments={[mockAttachment]} isEditable={true} mode="manage" />);
        
        const replaceButton = screen.getByRole('button', { name: /Replace attachment/i });
        
        await act(async () => {
            fireEvent.pointerDown(replaceButton);
        });

        const uploadOption = screen.getByText('Upload Document');
        await act(async () => {
            fireEvent.click(uploadOption);
        });

        // Find the replace hidden input - it's the second input type=file
        const inputs = document.querySelectorAll('input[type="file"]');
        const replaceInput = inputs[1] as HTMLInputElement;
        
        const validFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
        
        await act(async () => {
            fireEvent.change(replaceInput, { target: { files: [validFile] } });
        });

        expect(blobClient.upload).toHaveBeenCalled();
        
        await waitFor(() => {
            expect(attachmentActions.replaceFieldAttachment).toHaveBeenCalledWith(expect.objectContaining({
                instanceId: 'inst-1',
                attachmentDocumentId: 'new-doc-2',
                clientLEId: 'le-1',
                fieldNo: 1
            }));
        });
    });

    it('performs Add flow with proper instanceId', async () => {
        vi.mocked(blobClient.upload).mockResolvedValueOnce({} as any);
        vi.mocked(uploadIntent.getUploadIntentStatus).mockResolvedValueOnce({
            status: 'completed',
            attachment: { ...mockAttachment, documentId: 'new-doc-1' }
        });

        render(<FieldAttachments clientLEId="le-1" fieldNo={1} attachments={[]} isEditable={true} mode="manage" />);
        
        const attachButton = screen.getByRole('button', { name: /Add attachment/i });
        await act(async () => {
            fireEvent.pointerDown(attachButton);
        });
        
        const uploadOption = screen.getByText('Upload Document');
        await act(async () => {
            fireEvent.click(uploadOption);
        });

        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        const validFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
        
        await act(async () => {
            fireEvent.change(fileInput, { target: { files: [validFile] } });
        });

        expect(blobClient.upload).toHaveBeenCalled();
        
        await waitFor(() => {
            expect(attachmentActions.addFieldAttachment).toHaveBeenCalledWith(expect.objectContaining({
                attachmentDocumentId: 'new-doc-1',
                clientLEId: 'le-1',
                fieldNo: 1
            }));
        });
    });

    describe('Library Document Picker flows', () => {
        const mockLibraryDocs = [
            { id: 'lib-doc-1', fileName: 'lib1.pdf', mimeType: 'application/pdf', sizeBytes: 1024, createdAt: '2023-01-01' },
            { id: 'lib-doc-2', fileName: 'lib2.png', mimeType: 'image/png', sizeBytes: 2048, createdAt: '2023-01-02' }
        ];

        beforeEach(() => {
            vi.mocked(listLibraryDocumentsAction).mockResolvedValue(mockLibraryDocs);
        });

        it('Replace from Library calls replaceFieldAttachment with the correct instanceId', async () => {
            render(<FieldAttachments clientLEId="le-1" fieldNo={1} attachments={[mockAttachment]} isEditable={true} mode="manage" />);
            
            await act(async () => {
                fireEvent.pointerDown(screen.getByRole('button', { name: /Replace attachment/i }));
            });
            await act(async () => {
                fireEvent.click(screen.getByText('Choose from Library'));
            });

            // Dialog is open
            await screen.findByText('lib2.png');
            
            const selectBtns = screen.getAllByRole('button', { name: 'Select' });
            await act(async () => {
                fireEvent.click(selectBtns[1]); // select lib-doc-2
            });

            expect(attachmentActions.replaceFieldAttachment).toHaveBeenCalledWith(expect.objectContaining({
                instanceId: 'inst-1',
                attachmentDocumentId: 'lib-doc-2'
            }));
            expect(blobClient.upload).not.toHaveBeenCalled();
        });

        it('Add from Library never calls upload()', async () => {
            render(<FieldAttachments clientLEId="le-1" fieldNo={1} attachments={[]} isEditable={true} mode="manage" />);
            
            await act(async () => {
                fireEvent.pointerDown(screen.getByRole('button', { name: /Add attachment/i }));
            });
            await act(async () => {
                fireEvent.click(screen.getByText('Choose from Library'));
            });

            await screen.findByText('lib1.pdf');
            
            await act(async () => {
                fireEvent.click(screen.getAllByRole('button', { name: 'Select' })[0]); // select lib-doc-1
            });

            expect(attachmentActions.addFieldAttachment).toHaveBeenCalledWith(expect.objectContaining({
                attachmentDocumentId: 'lib-doc-1'
            }));
            expect(blobClient.upload).not.toHaveBeenCalled();
        });

        it('A library-fetch failure permits a second attempt', async () => {
            vi.mocked(listLibraryDocumentsAction).mockRejectedValueOnce(new Error('Fetch failed'));

            render(<FieldAttachments clientLEId="le-1" fieldNo={1} attachments={[]} isEditable={true} mode="manage" />);
            
            await act(async () => {
                fireEvent.pointerDown(screen.getByRole('button', { name: /Add attachment/i }));
            });
            await act(async () => {
                fireEvent.click(screen.getByText('Choose from Library'));
            });

            expect(toast.error).toHaveBeenCalledWith('Fetch failed');
            expect(screen.queryByText('Choose a document')).not.toBeInTheDocument();

            // Try again
            await act(async () => {
                fireEvent.pointerDown(screen.getByRole('button', { name: /Add attachment/i }));
            });
            await act(async () => {
                fireEvent.click(screen.getByText('Choose from Library'));
            });
            
            // Should open dialog now
            expect(await screen.findByText('Choose a document')).toBeInTheDocument();
        });

        it('Reopening the picker reloads current library contents', async () => {
            render(<FieldAttachments clientLEId="le-1" fieldNo={1} attachments={[]} isEditable={true} mode="manage" />);
            
            // Open first time
            await act(async () => {
                fireEvent.pointerDown(screen.getByRole('button', { name: /Add attachment/i }));
            });
            await act(async () => {
                fireEvent.click(screen.getByText('Choose from Library'));
            });
            await screen.findByText('lib1.pdf');

            // Close Dialog
            await act(async () => {
                const closeBtn = screen.getByRole('button', { name: 'Close' });
                fireEvent.click(closeBtn);
            });

            // Open second time
            await act(async () => {
                const addBtn = screen.getByRole('button', { name: /Add attachment/i });
                // If it's already open, this might close it, so check first
                if (addBtn.getAttribute('data-state') !== 'open') {
                    fireEvent.pointerDown(addBtn);
                }
            });
            await act(async () => {
                fireEvent.click(screen.getByText('Choose from Library'));
            });

            expect(listLibraryDocumentsAction).toHaveBeenCalledTimes(2);
        });

        it('Choosing from Library cannot be triggered twice while the attachment action is processing', async () => {
            // make addFieldAttachment slow
            vi.mocked(attachmentActions.addFieldAttachment).mockImplementation(() => new Promise(res => setTimeout(res, 100)));
            
            render(<FieldAttachments clientLEId="le-1" fieldNo={1} attachments={[]} isEditable={true} mode="manage" />);
            
            await act(async () => {
                fireEvent.pointerDown(screen.getByRole('button', { name: /Add attachment/i }));
            });
            await act(async () => {
                fireEvent.click(screen.getByText('Choose from Library'));
            });

            await screen.findByText('lib1.pdf');
            
            // Select and enter PROCESSING state
            act(() => {
                fireEvent.click(screen.getAllByRole('button', { name: 'Select' })[0]);
            });

            // Dialog is gone, and the main button is disabled or no longer showing "Add attachment" directly
            // Wait for processing
            await waitFor(() => {
                expect(screen.queryByText('Add attachment')).not.toBeInTheDocument();
            });
            expect(screen.getByText('OnPro is processing...')).toBeInTheDocument();
        });
    });

    it('shows accessible Remove confirmation dialog and preserves attachment on cancel', async () => {
        render(<FieldAttachments clientLEId="le-1" fieldNo={1} attachments={[mockAttachment]} isEditable={true} mode="manage" />);
        
        const removeButton = screen.getByTitle('Remove attachment');
        fireEvent.click(removeButton);
        
        // Dialog should be visible
        expect(screen.getByText('Remove attachment', { selector: 'h2' })).toBeInTheDocument();
        expect(screen.getByText(/The document will remain in OnPro/)).toBeInTheDocument();

        // Cancel
        const cancelButton = screen.getByText('Cancel');
        fireEvent.click(cancelButton);

        expect(attachmentActions.removeFieldAttachment).not.toHaveBeenCalled();

        // Confirm
        fireEvent.click(screen.getByTitle('Remove attachment'));
        const confirmButton = screen.getByText('Remove', { selector: 'button' });
        
        await act(async () => {
            fireEvent.click(confirmButton);
        });

        expect(attachmentActions.removeFieldAttachment).toHaveBeenCalledWith(expect.objectContaining({
            instanceId: 'inst-1'
        }));
    });

    it('uses correct authenticated download URL and no direct Blob URL', () => {
        render(<FieldAttachments clientLEId="le-1" fieldNo={1} attachments={[mockAttachment]} isEditable={true} mode="read-only" />);
        const downloadLink = screen.getByTitle('Download') as HTMLAnchorElement;
        expect(downloadLink.href).toContain('/api/documents/doc-1/download');
        expect(downloadLink.href).not.toContain('blob.vercel-storage');
    });

    it('provides Retry status check on polling timeout', async () => {
        vi.mocked(blobClient.upload).mockResolvedValueOnce({} as any);
        // Mock pending 31 times to trigger timeout
        vi.mocked(uploadIntent.getUploadIntentStatus).mockResolvedValue({ status: 'pending' });

        render(<FieldAttachments clientLEId="le-1" fieldNo={1} attachments={[]} isEditable={true} mode="manage" />);
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        const validFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
        
        // Use fake timers to speed through the 30 polls
        vi.useFakeTimers();
        
        await act(async () => {
            fireEvent.change(fileInput, { target: { files: [validFile] } });
        });

        // Fast forward 31 intervals
        await act(async () => {
            for (let i = 0; i < 35; i++) {
                vi.advanceTimersByTime(2000);
                await Promise.resolve(); // flush microtasks
            }
        });

        expect(screen.getByText('Retry status check')).toBeInTheDocument();
        
        vi.useRealTimers();
    });

    it('displays error on failed intent', async () => {
        vi.mocked(blobClient.upload).mockResolvedValueOnce({} as any);
        vi.mocked(uploadIntent.getUploadIntentStatus).mockResolvedValueOnce({ status: 'failed', message: 'Virus detected' });

        render(<FieldAttachments clientLEId="le-1" fieldNo={1} attachments={[]} isEditable={true} mode="manage" />);
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        const validFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
        
        await act(async () => {
            fireEvent.change(fileInput, { target: { files: [validFile] } });
        });

        await waitFor(() => {
            expect(screen.getByText('Virus detected')).toBeInTheDocument();
        });
    });
});
