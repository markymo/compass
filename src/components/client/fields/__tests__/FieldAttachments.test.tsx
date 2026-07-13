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
import { toast } from 'sonner';

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
    instanceId: 'inst-1',
    documentId: 'doc-1',
    displayName: 'Test Doc.pdf',
    mimeType: 'application/pdf',
    sizeBytes: '1024',
    lifecycleCreatedAt: '2023-01-01T00:00:00Z',
    currentDocumentCreatedAt: '2023-01-01T00:00:00Z'
};

describe('FieldAttachments UI', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        cleanup();
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
        expect(screen.getByTitle('Replace attachment')).toBeInTheDocument();
        expect(screen.getByTitle('Remove attachment')).toBeInTheDocument();
    });

    it('read-only mode never shows mutation controls', () => {
        render(<FieldAttachments clientLEId="le-1" fieldNo={1} attachments={[mockAttachment]} isEditable={true} mode="read-only" />);
        expect(screen.queryByTitle('Replace attachment')).not.toBeInTheDocument();
        expect(screen.queryByTitle('Remove attachment')).not.toBeInTheDocument();
        expect(screen.queryByText('Attach Document')).not.toBeInTheDocument();
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
        
        const replaceButton = screen.getByTitle('Replace attachment');
        
        await act(async () => {
            fireEvent.click(replaceButton);
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
