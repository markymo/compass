/**
 * @vitest-environment happy-dom
 */
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

afterEach(() => { cleanup(); });

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FilesLibraryManager } from '../FilesLibraryManager';
import { getLibraryDocumentDetailsAction } from '@/actions/document-library-actions';

vi.mock('@/actions/document-library-actions', () => ({
    getLibraryDocumentDetailsAction: vi.fn()
}));

vi.mock("next-auth", () => ({
    default: vi.fn(() => ({
        handlers: {},
        auth: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn()
    }))
}));
vi.mock("next/server", () => ({ NextResponse: {} }));
vi.mock("next/navigation", () => ({
    useRouter: () => ({
        refresh: vi.fn(),
        push: vi.fn(),
        replace: vi.fn()
    })
}));

const mockFiles = [
    {
        id: 'doc-1',
        filename: 'ActiveDoc.pdf',
        mimeType: 'application/pdf',
        sizeBytes: '2048',
        createdAt: '2026-07-16T10:00:00.000Z',
        uploadedBy: { id: 'u1', displayName: 'Alice' },
        currentUsageCount: 2,
        historicalUsageCount: 1,
        status: 'IN_USE' as const
    },
    {
        id: 'doc-2',
        filename: 'historic_IMAGE.png',
        mimeType: 'image/png',
        sizeBytes: '1048576',
        createdAt: '2026-07-15T10:00:00.000Z',
        uploadedBy: null,
        currentUsageCount: 0,
        historicalUsageCount: 3,
        status: 'PREVIOUSLY_USED' as const
    },
    {
        id: 'doc-3',
        filename: 'UnusedSpreadsheet.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        sizeBytes: '0',
        createdAt: '2026-07-14T10:00:00.000Z',
        uploadedBy: { id: 'u2', displayName: 'Bob' },
        currentUsageCount: 0,
        historicalUsageCount: 0,
        status: 'UNUSED' as const
    }
];

describe('FilesLibraryManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders populated library with all documents visible regardless of status', () => {
        render(<FilesLibraryManager clientLEId="le-1" initialFiles={mockFiles} />);
        
        expect(screen.getAllByText('ActiveDoc.pdf')[0]).toBeInTheDocument();
        expect(screen.getAllByText('historic_IMAGE.png')[0]).toBeInTheDocument();
        expect(screen.getAllByText('ActiveDoc.pdf')[0]).toBeInTheDocument();
        expect(screen.getAllByText('historic_IMAGE.png')[0]).toBeInTheDocument();
        expect(screen.getAllByText('UnusedSpreadsheet.xlsx')[0]).toBeInTheDocument();
    });

    it('renders both current and historical counts properly formatted', () => {
        render(<FilesLibraryManager clientLEId="le-1" initialFiles={mockFiles} />);
        
        expect(screen.getAllByText('2 current')[0]).toBeInTheDocument();
        expect(screen.getAllByText('1 historic')[0]).toBeInTheDocument();

        expect(screen.getAllByText('0 current')[0]).toBeInTheDocument();
        expect(screen.getAllByText('3 historic')[0]).toBeInTheDocument();
    });

    it('formats ISO dates and byte strings correctly', () => {
        render(<FilesLibraryManager clientLEId="le-1" initialFiles={mockFiles} />);
        
        // 2048 bytes -> 2 KB
        expect(screen.getByText('2 KB')).toBeInTheDocument();
        // 1048576 bytes -> 1 MB
        expect(screen.getByText('1 MB')).toBeInTheDocument();
        // 0 bytes -> 0 B
        expect(screen.getByText('0 B')).toBeInTheDocument();

        // 16 Jul 2026
        expect(screen.getByText(/16 Jul 2026/i)).toBeInTheDocument();
    });

    it('performs case-insensitive search', () => {
        render(<FilesLibraryManager clientLEId="le-1" initialFiles={mockFiles} />);
        
        const searchInput = screen.getByPlaceholderText('Search files by name...');
        fireEvent.change(searchInput, { target: { value: 'image' } });
        
        expect(screen.queryByText('ActiveDoc.pdf')).not.toBeInTheDocument();
        expect(screen.getAllByText('historic_IMAGE.png')[0]).toBeInTheDocument();
        expect(screen.queryByText('UnusedSpreadsheet.xlsx')).not.toBeInTheDocument();
    });

    it('displays distinct empty states for empty library vs no search results', () => {
        const { rerender } = render(<FilesLibraryManager clientLEId="le-1" initialFiles={[]} />);
        expect(screen.getByText('No documents have been added.')).toBeInTheDocument();

        rerender(<FilesLibraryManager clientLEId="le-1" initialFiles={mockFiles} />);
        const searchInput = screen.getByPlaceholderText('Search files by name...');
        fireEvent.change(searchInput, { target: { value: 'doesnotexist' } });
        
        expect(screen.queryByText('No documents have been added.')).not.toBeInTheDocument();
        expect(screen.getByText('No documents match your search.')).toBeInTheDocument();
    });

    it('opens drawer on row click, or Enter key', async () => {
        render(<FilesLibraryManager clientLEId="le-1" initialFiles={mockFiles} />);
        
        const row = screen.getAllByText('ActiveDoc.pdf')[0].closest('tr')!;
        
        // Keyboard activation
        fireEvent.keyDown(row, { key: 'Enter', code: 'Enter' });
        
        expect(getLibraryDocumentDetailsAction).toHaveBeenCalledWith('doc-1', 'le-1');
        
        await waitFor(() => {
            expect(screen.getByText('Document Details')).toBeInTheDocument();
        });
    });

    it('does not open drawer when download button is clicked', () => {
        render(<FilesLibraryManager clientLEId="le-1" initialFiles={mockFiles} />);
        
        const downloadLink = screen.getAllByText('Download ActiveDoc.pdf')[0].closest('a')!;
        fireEvent.click(downloadLink);
        
        // Drawer should not open, action should not be called
        expect(getLibraryDocumentDetailsAction).not.toHaveBeenCalled();
    });

    it('displays Retry on detail fetch failure', async () => {
        vi.mocked(getLibraryDocumentDetailsAction).mockRejectedValueOnce(new Error('Failed'));
        
        render(<FilesLibraryManager clientLEId="le-1" initialFiles={mockFiles} />);
        fireEvent.click(screen.getAllByText('ActiveDoc.pdf')[0].closest('tr')!);
        
        await waitFor(() => {
            expect(screen.getByText('Unable to load document details')).toBeInTheDocument();
            expect(screen.getByText('Retry')).toBeInTheDocument();
        });
    });

    it('renders unknown usage safely', async () => {
        const mockDetail = {
            id: 'doc-1',
            filename: 'ActiveDoc.pdf',
            mimeType: 'application/pdf',
            sizeBytes: '2048',
            createdAt: '2026-07-16T10:00:00.000Z',
            uploadedBy: null,
            currentUsageCount: 1,
            historicalUsageCount: 0,
            status: 'IN_USE' as const,
            usageHistory: [],
            currentUsages: [
                { type: 'UNKNOWN_FUTURE_TYPE' as any, instanceId: 'inst-1', fieldNo: 1, fieldLabel: 'Should Ignore', attachedAt: '2026-07-16T10:00:00.000Z' }
            ]
        };
        
        vi.mocked(getLibraryDocumentDetailsAction).mockResolvedValueOnce(mockDetail);
        
        render(<FilesLibraryManager clientLEId="le-1" initialFiles={mockFiles} />);
        fireEvent.click(screen.getAllByText('ActiveDoc.pdf')[0].closest('tr')!);
        
        await waitFor(() => {
            expect(screen.getByText('Used elsewhere')).toBeInTheDocument();
            expect(screen.queryByText('Should Ignore')).not.toBeInTheDocument();
        });
    });

    it('does not display stale details when selecting a second document quickly', async () => {
        let resolveFirst: any;
        const promiseFirst = new Promise((resolve) => { resolveFirst = resolve; });
        
        let resolveSecond: any;
        const promiseSecond = new Promise((resolve) => { resolveSecond = resolve; });

        vi.mocked(getLibraryDocumentDetailsAction).mockImplementation((id) => {
            if (id === 'doc-1') return promiseFirst as any;
            if (id === 'doc-2') return promiseSecond as any;
            return Promise.resolve({} as any);
        });

        render(<FilesLibraryManager clientLEId="le-1" initialFiles={mockFiles} />);
        
        // Click first row
        fireEvent.click(screen.getAllByText('ActiveDoc.pdf')[0].closest('tr')!);
        // Click second row immediately
        fireEvent.click(screen.getAllByText('historic_IMAGE.png')[0].closest('tr')!);

        // Resolve first request with stale data
        resolveFirst({
            id: 'doc-1',
            filename: 'ActiveDoc.pdf',
            mimeType: 'application/pdf',
            sizeBytes: '2048',
            createdAt: '2026-07-16T10:00:00.000Z',
            uploadedBy: null,
            currentUsageCount: 0,
            historicalUsageCount: 0,
            status: 'UNUSED',
            usageHistory: [],
            currentUsages: []
        });

        // The UI should NOT show ActiveDoc.pdf because we are looking at doc-2
        await waitFor(() => {
            // Since doc-2 is loading, it should show "Loading details..."
            expect(screen.getByText('Loading details...')).toBeInTheDocument();
        });

        // Resolve second request
        resolveSecond({
            id: 'doc-2',
            filename: 'historic_IMAGE.png',
            mimeType: 'image/png',
            sizeBytes: '1024',
            createdAt: '2026-07-16T10:00:00.000Z',
            uploadedBy: null,
            currentUsageCount: 0,
            historicalUsageCount: 0,
            status: 'UNUSED',
            usageHistory: [],
            currentUsages: []
        });

        await waitFor(() => {
            expect(screen.getAllByText('historic_IMAGE.png').length).toBeGreaterThan(0); // Appears in metadata
        });
    });

    it('does not expose internal Blob URLs', () => {
        render(<FilesLibraryManager clientLEId="le-1" initialFiles={mockFiles} />);
        const html = document.body.innerHTML;
        // Verify `vercel-storage.com` does not appear anywhere
        expect(html).not.toMatch(/vercel-storage\.com/i);
    });
});
