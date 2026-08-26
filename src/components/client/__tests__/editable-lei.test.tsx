/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EditableLEI } from '../editable-lei';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh: vi.fn() })
}));

describe('EditableLEI Component Verification Date', () => {
    it('renders deterministic UK date format (DD/MM/YYYY) in standard variant', () => {
        const fetchedAt = new Date('2026-08-20T14:30:00Z');
        const { unmount } = render(
            <EditableLEI
                leId="test-le-id"
                initialLei="21380088Z88Z88Z88Z88"
                initialFetchedAt={fetchedAt}
                variant="standard"
            />
        );

        expect(screen.getByText((content) => content.includes('Verified') && content.includes('20/08/2026'))).toBeDefined();
        unmount();
    });

    it('renders deterministic UK date format (DD/MM/YYYY) in minimal variant', () => {
        const fetchedAt = new Date('2026-08-20T14:30:00Z');
        const { unmount } = render(
            <EditableLEI
                leId="test-le-id"
                initialLei="21380088Z88Z88Z88Z88"
                initialFetchedAt={fetchedAt}
                variant="minimal"
            />
        );

        expect(screen.getByText((content) => content.includes('Verified') && content.includes('20/08/2026'))).toBeDefined();
        unmount();
    });
});
