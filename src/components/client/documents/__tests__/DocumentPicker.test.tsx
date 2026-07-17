/**
 * @vitest-environment happy-dom
 */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { DocumentPicker } from '../DocumentPicker';

const MOCK_DOCS = [
    {
        id: 'doc-1',
        fileName: 'passport.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024 * 1024,
        createdAt: '2025-01-01T10:00:00Z'
    },
    {
        id: 'doc-2',
        fileName: 'company-structure.png',
        mimeType: 'image/png',
        sizeBytes: 500 * 1024,
        createdAt: '2025-01-02T10:00:00Z'
    }
];

describe('DocumentPicker', () => {
    afterEach(() => { cleanup(); vi.resetAllMocks(); });
    it('renders empty state when no documents are provided', () => {
        render(
            <DocumentPicker
                isOpen={true}
                onClose={() => {}}
                documents={[]}
                onSelect={() => {}}
                mode={{ type: 'ADD' }}
            />
        );
        expect(screen.getByText('No documents are available in the Files Library.')).toBeInTheDocument();
    });

    it('renders documents and allows selection', () => {
        const onSelect = vi.fn();
        render(
            <DocumentPicker
                isOpen={true}
                onClose={() => {}}
                documents={MOCK_DOCS}
                onSelect={onSelect}
                mode={{ type: 'ADD' }}
            />
        );

        expect(screen.getByText('passport.pdf')).toBeInTheDocument();
        expect(screen.getByText('company-structure.png')).toBeInTheDocument();

        const selectBtns = screen.getAllByRole('button', { name: 'Select' });
        expect(selectBtns).toHaveLength(2);
        
        fireEvent.click(selectBtns[0]);
        expect(onSelect).toHaveBeenCalledWith(MOCK_DOCS[0]);
    });

    it('disables documents that are already attached', () => {
        render(
            <DocumentPicker
                isOpen={true}
                onClose={() => {}}
                documents={MOCK_DOCS}
                onSelect={() => {}}
                disabledDocumentIds={['doc-1']}
                mode={{ type: 'REPLACE', instanceId: 'inst-1' }}
            />
        );

        expect(screen.getByText('Already attached')).toBeInTheDocument();
        const selectBtn = screen.getByRole('button', { name: 'Select' }); // Only one available
        expect(selectBtn).not.toBeDisabled();
    });

    it('shows all-attached empty state when all documents are disabled', () => {
        render(
            <DocumentPicker
                isOpen={true}
                onClose={() => {}}
                documents={MOCK_DOCS}
                onSelect={() => {}}
                disabledDocumentIds={['doc-1', 'doc-2']}
                mode={{ type: 'ADD' }}
            />
        );

        expect(screen.getByText('All available documents are already attached to this field.')).toBeInTheDocument();
    });

    it('filters documents by search query', () => {
        render(
            <DocumentPicker
                isOpen={true}
                onClose={() => {}}
                documents={MOCK_DOCS}
                onSelect={() => {}}
                mode={{ type: 'ADD' }}
            />
        );

        const searchInput = screen.getByPlaceholderText('Search documents...');
        
        act(() => {
            fireEvent.change(searchInput, { target: { value: 'passport' } });
        });

        expect(screen.getByText('passport.pdf')).toBeInTheDocument();
        expect(screen.queryByText('company-structure.png')).not.toBeInTheDocument();
    });
});
