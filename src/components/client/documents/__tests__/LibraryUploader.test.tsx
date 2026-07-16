/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { LibraryUploader } from '../LibraryUploader';
import { upload } from '@vercel/blob/client';
import { getUploadIntentStatus } from '@/actions/upload-intent';
import { toast } from 'sonner';

// Mock dependencies
vi.mock('@vercel/blob/client', () => ({
    upload: vi.fn()
}));

vi.mock('@/actions/upload-intent', () => ({
    getUploadIntentStatus: vi.fn()
}));

vi.mock('sonner', () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn()
    }
}));

const mockRefresh = vi.fn();
vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh: mockRefresh })
}));

describe('LibraryUploader', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });

    it('invalid size rejected before upload', async () => {
        render(<LibraryUploader clientLEId="le-1" />);
        const input = document.querySelector('input[type="file"]') as HTMLInputElement;
        
        // Mock a 25MB file
        const file = new File([''], 'huge.pdf', { type: 'application/pdf' });
        Object.defineProperty(file, 'size', { value: 25 * 1024 * 1024 });

        fireEvent.change(input, { target: { files: [file] } });

        expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('20MB limit'));
        expect(upload).not.toHaveBeenCalled();
    });

    it('invalid type rejected before upload', async () => {
        render(<LibraryUploader clientLEId="le-1" />);
        const input = document.querySelector('input[type="file"]') as HTMLInputElement;
        
        const file = new File([''], 'script.exe', { type: 'application/x-msdownload' });
        fireEvent.change(input, { target: { files: [file] } });

        expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('is not supported'));
        expect(upload).not.toHaveBeenCalled();
    });

    it('idle -> uploading percentage -> processing', async () => {
        render(<LibraryUploader clientLEId="le-1" />);
        const input = document.querySelector('input[type="file"]') as HTMLInputElement;
        
        let progressCallback: any;
        vi.mocked(upload).mockImplementation(async (path, file, options: any) => {
            progressCallback = options.onUploadProgress;
            progressCallback({ percentage: 45 });
            return {} as any;
        });
        
        // Mock polling to not immediately resolve
        vi.mocked(getUploadIntentStatus).mockResolvedValue({ status: 'pending' });

        const file = new File(['hello'], 'doc.pdf', { type: 'application/pdf' });
        fireEvent.change(input, { target: { files: [file] } });

        // Wait for state updates after upload starts
        await waitFor(() => {
            expect(screen.getByText('Uploading 45%…')).toBeInTheDocument();
        });

        // The mock upload resolves, it should switch to PROCESSING
        await waitFor(() => {
            expect(screen.getByText('Processing…')).toBeInTheDocument();
        });
    });

    it('completed intent triggers one router.refresh()', async () => {
        render(<LibraryUploader clientLEId="le-1" />);
        const input = document.querySelector('input[type="file"]') as HTMLInputElement;
        
        vi.mocked(upload).mockResolvedValue({} as any);
        vi.mocked(getUploadIntentStatus).mockResolvedValueOnce({ status: 'pending' })
                                        .mockResolvedValueOnce({ status: 'completed', attachment: { documentId: 'doc-1' } } as any);

        const file = new File(['hello'], 'doc.pdf', { type: 'application/pdf' });
        fireEvent.change(input, { target: { files: [file] } });

        // Wait for upload to trigger processing
        await waitFor(() => {
            expect(getUploadIntentStatus).toHaveBeenCalled();
        });

        // Advance timers to trigger the next poll
        await vi.runOnlyPendingTimersAsync();

        await waitFor(() => {
            expect(toast.success).toHaveBeenCalledWith('Document uploaded successfully');
            expect(mockRefresh).toHaveBeenCalledTimes(1);
            expect(screen.getByText('Upload Document')).toBeInTheDocument(); // Reset to idle
        });
    });

    it('failed upload resets the control and shows an error', async () => {
        render(<LibraryUploader clientLEId="le-1" />);
        const input = document.querySelector('input[type="file"]') as HTMLInputElement;
        
        vi.mocked(upload).mockRejectedValue(new Error('Network Error'));

        const file = new File(['hello'], 'doc.pdf', { type: 'application/pdf' });
        fireEvent.change(input, { target: { files: [file] } });

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith('Network Error');
            expect(screen.getByText('Upload Document')).toBeInTheDocument();
        });
    });

    it('failed processing intent resets the control and shows an error', async () => {
        render(<LibraryUploader clientLEId="le-1" />);
        const input = document.querySelector('input[type="file"]') as HTMLInputElement;
        
        vi.mocked(upload).mockResolvedValue({} as any);
        vi.mocked(getUploadIntentStatus).mockResolvedValueOnce({ status: 'failed', message: 'Virus detected' });

        const file = new File(['hello'], 'doc.pdf', { type: 'application/pdf' });
        fireEvent.change(input, { target: { files: [file] } });

        // Advance timers for polling if needed
        await vi.runOnlyPendingTimersAsync();

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith('Virus detected');
            expect(screen.getByText('Upload Document')).toBeInTheDocument();
        });
    });

    it('polling timeout or repeated polling failure', async () => {
        render(<LibraryUploader clientLEId="le-1" />);
        const input = document.querySelector('input[type="file"]') as HTMLInputElement;
        
        vi.mocked(upload).mockResolvedValue({} as any);
        vi.mocked(getUploadIntentStatus).mockResolvedValue({ status: 'pending' });

        const file = new File(['hello'], 'doc.pdf', { type: 'application/pdf' });
        fireEvent.change(input, { target: { files: [file] } });

        // Let it poll 31 times
        for (let i = 0; i < 32; i++) {
            await vi.runOnlyPendingTimersAsync();
        }

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith('Upload processing timed out. Please check again later.');
            expect(screen.getByText('Upload Document')).toBeInTheDocument();
        });
    });

    it('no concurrent second upload while one is active', async () => {
        render(<LibraryUploader clientLEId="le-1" />);
        const input = document.querySelector('input[type="file"]') as HTMLInputElement;
        
        // Mock upload to hang
        let resolveUpload: any;
        vi.mocked(upload).mockImplementation(() => new Promise((resolve) => { resolveUpload = resolve; }));

        const file = new File(['hello'], 'doc.pdf', { type: 'application/pdf' });
        fireEvent.change(input, { target: { files: [file] } });

        await waitFor(() => {
            expect(screen.getByText(/Uploading/)).toBeInTheDocument();
        });

        // The button should be disabled
        const button = screen.getByRole('button');
        expect(button).toBeDisabled();

        // The input should be disabled
        expect(input).toBeDisabled();

        // Attempting to change input should not do anything (though it's disabled, we can manually trigger event to test safety)
        fireEvent.change(input, { target: { files: [new File([''], 'another.pdf', { type: 'application/pdf'})] } });
        
        // Upload should have only been called once
        expect(upload).toHaveBeenCalledTimes(1);

        resolveUpload({});
    });
});
