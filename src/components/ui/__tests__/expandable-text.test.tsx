/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ExpandableText, truncateToNearestWord } from '../expandable-text';

describe('ExpandableText Component & Finesse Thresholds', () => {

    afterEach(() => {
        cleanup();
    });

    describe('truncateToNearestWord helper', () => {
        it('returns original string if length is within targetChars', () => {
            const short = 'Short string.';
            expect(truncateToNearestWord(short, 300)).toBe(short);
        });

        it('truncates at nearest word boundary when string exceeds targetChars', () => {
            const text = 'The quick brown fox jumps over the lazy dog and runs away into the forest where nobody can find it.';
            const result = truncateToNearestWord(text, 50);
            expect(result.length).toBeLessThanOrEqual(50);
            expect(result.endsWith(' ')).toBe(false);
            expect(text.startsWith(result)).toBe(true);
            expect(result).toBe('The quick brown fox jumps over the lazy dog and');
        });
    });

    describe('ExpandableText Component Rendering & Finesse Threshold', () => {
        it('renders null when text is null, undefined, or empty', () => {
            const { container: c1 } = render(<ExpandableText text={null} />);
            expect(c1.firstChild).toBeNull();

            const { container: c2 } = render(<ExpandableText text={undefined} />);
            expect(c2.firstChild).toBeNull();

            const { container: c3 } = render(<ExpandableText text="   " />);
            expect(c3.firstChild).toBeNull();
        });

        it('renders text <= 400 chars completely untouched (e.g. 350 chars) with NO Show more button', () => {
            const word = 'word ';
            const mediumText = word.repeat(70).trim(); // 349 characters (between 300 and 400)
            const { container } = render(<ExpandableText text={mediumText} targetChars={300} overflowThreshold={400} />);

            expect(container.textContent?.trim()).toBe(mediumText);
            expect(screen.queryByRole('button', { name: /show more/i })).toBeNull();
        });

        it('truncates text > 400 chars back to nearest word boundary near 300 chars with inline Show more button', () => {
            const word = 'word ';
            const longText = word.repeat(100); // 500 characters (> 400)
            render(<ExpandableText text={longText} targetChars={300} overflowThreshold={400} />);

            const btn = screen.getByRole('button', { name: /show more/i });
            expect(btn).toBeTruthy();

            // Truncated text span must be near 300 characters, not 400+ characters
            const textSpan = btn.parentElement;
            expect(textSpan?.textContent).toContain('…');
            
            // Truncated snippet length before "…" should be close to 300 chars (~300 ± 10)
            const textBeforeEllipsis = textSpan?.textContent?.split('…')[0] || '';
            expect(textBeforeEllipsis.length).toBeLessThanOrEqual(300);
            expect(textBeforeEllipsis.length).toBeGreaterThan(250);
        });

        it('expands to show complete text and inline Show less button when clicked', () => {
            const word = 'word ';
            const longText = word.repeat(100); // 500 characters
            render(<ExpandableText text={longText} targetChars={300} overflowThreshold={400} />);

            const showMoreBtn = screen.getByRole('button', { name: /show more/i });
            fireEvent.click(showMoreBtn);

            // Should show full text and Show less button
            const showLessBtn = screen.getByRole('button', { name: /show less/i });
            expect(showLessBtn).toBeTruthy();

            // Clicking Show less collapses it back
            fireEvent.click(showLessBtn);
            expect(screen.getByRole('button', { name: /show more/i })).toBeTruthy();
        });

        it('does not format markdown tokens when renderContent is omitted (unrelated consumer isolation)', () => {
            const rawText = "Plain consumer with **unformatted** and *tokens*.";
            render(<ExpandableText text={rawText} />);

            expect(screen.getByText(rawText)).toBeTruthy();
            expect(document.querySelector('strong')).toBeNull();
            expect(document.querySelector('em')).toBeNull();
        });

        it('applies custom renderContent to both truncated and expanded text', () => {
            const longText = "Prefix **bold-start** " + "word ".repeat(90) + "suffix **bold-end**";
            const mockRender = (str: string) => {
                const parts = str.split(/(\*\*.*?\*\*)/g);
                return parts.map((p, i) => p.startsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : p);
            };

            render(<ExpandableText text={longText} targetChars={300} overflowThreshold={400} renderContent={mockRender} />);

            // When collapsed, bold-start should be rendered inside <strong>
            expect(screen.getByText('bold-start').tagName).toBe('STRONG');
            expect(screen.queryByText('bold-end')).toBeNull();

            // Expand
            fireEvent.click(screen.getByRole('button', { name: /show more/i }));
            expect(screen.getByText('bold-start').tagName).toBe('STRONG');
            expect(screen.getByText('bold-end').tagName).toBe('STRONG');
        });
    });
});

