import { describe, it, expect, vi } from 'vitest';
import { FieldSourceBadge, FieldSourceBadgeProps } from '../FieldSourceBadge';
import { FieldSource } from '@/lib/master-data/field-display-model';
import { useSession } from 'next-auth/react';

vi.mock('next-auth/react', () => ({
    useSession: vi.fn(() => ({ data: { user: { timezone: 'UTC' } } }))
}));

describe('FieldSourceBadge', () => {
    // Helper to extract className from the returned React element
    const getClassName = (props: FieldSourceBadgeProps) => {
        const element: any = FieldSourceBadge(props);
        return element?.props?.className || '';
    };

    const getChildrenStr = (props: FieldSourceBadgeProps) => {
        const element: any = FieldSourceBadge(props);
        // Children might be deeply nested depending on how it's returned
        return JSON.stringify(element?.props?.children || '');
    };

    describe('Canonical source props', () => {
        it('renders basic canonical source correctly', () => {
            const source: FieldSource = {
                type: 'USER_INPUT',
                label: 'User Data',
                colorKey: 'USER',
                category: 'USER'
            };
            const className = getClassName({ source });
            const children = getChildrenStr({ source });
            
            expect(children).toContain('User Data');
            expect(className).toContain('bg-purple-100 text-purple-700 border-purple-200');
        });

        it('renders RA source without RA code suffix', () => {
            const source: FieldSource = {
                type: 'REGISTRATION_AUTHORITY',
                reference: 'RA000585',
                label: 'Companies House',
                colorKey: 'REGISTRY',
                category: 'REGISTRY'
            };
            const className = getClassName({ source });
            const children = getChildrenStr({ source });
            
            expect(children).toContain('Companies House');
            expect(children).not.toContain('RA000585');
            expect(className).toContain('bg-blue-100 text-blue-700 border-blue-200');
        });
    });

    describe('Legacy fallback props', () => {
        it('resolves basic legacy source dynamically', () => {
            const className = getClassName({ legacySourceType: 'USER_INPUT' });
            const children = getChildrenStr({ legacySourceType: 'USER_INPUT' });
            
            expect(children).toContain('User input'); // resolved via getSourceDisplayName
            expect(className).toContain('bg-purple-100 text-purple-700 border-purple-200');
        });

        it('resolves legacy RA with name and hides ID', () => {
            const props = {
                legacySourceType: 'REGISTRATION_AUTHORITY',
                legacyRaId: 'RA000585',
                legacyRaName: 'Companies House'
            };
            const className = getClassName(props);
            const children = getChildrenStr(props);
            
            expect(children).toContain('Companies House');
            expect(children).not.toContain('RA000585');
            expect(className).toContain('bg-blue-100 text-blue-700 border-blue-200');
        });

        it('falls back to default colors for unknown source', () => {
            const className = getClassName({ legacySourceType: 'UNKNOWN_STUFF' });
            expect(className).toContain('bg-slate-100 text-slate-700 border-slate-200'); // SYSTEM default
        });
    });

    describe('Rendering variants', () => {
        it('applies custom className', () => {
            const className = getClassName({ legacySourceType: 'USER_INPUT', className: 'uppercase tracking-wider' });
            expect(className).toContain('uppercase tracking-wider');
            expect(className).toContain('bg-purple-100 text-purple-700 border-purple-200');
        });

        it('renders wrapper div when wrapperClassName is provided', () => {
            const element: any = FieldSourceBadge({ legacySourceType: 'USER_INPUT', wrapperClassName: 'flex-wrap' });
            expect(element?.type).toBe('div');
            expect(element?.props?.className).toBe('flex-wrap');
            // The inner element should be our badge/span
            const inner = element?.props?.children;
            expect(inner?.props?.className).toContain('bg-purple-100');
        });
        describe('Timezone formatting', () => {
        const mockLastValidatedAt = '2026-07-20T12:29:00Z'; // UTC time

        it('formats lastValidatedAt in UTC when session timezone is UTC', () => {
            vi.mocked(useSession).mockReturnValue({ data: { user: { timezone: 'UTC' } } } as any);
            const children = getChildrenStr({ 
                source: { type: 'USER_INPUT', lastValidatedAt: mockLastValidatedAt }, 
                showLastValidated: true 
            });
            expect(children).toContain('12:29 UTC');
        });

        it('formats lastValidatedAt in BST when session timezone is Europe/London', () => {
            vi.mocked(useSession).mockReturnValue({ data: { user: { timezone: 'Europe/London' } } } as any);
            const children = getChildrenStr({
                source: { type: 'USER_INPUT', lastValidatedAt: mockLastValidatedAt },
                showLastValidated: true
            });
            expect(children).toContain('13:29 BST');
        });

        it('renders generalized tooltip text', () => {
            vi.mocked(useSession).mockReturnValue({ data: { user: { timezone: 'UTC' } } } as any);
            const children = getChildrenStr({
                source: { type: 'USER_INPUT', lastValidatedAt: mockLastValidatedAt },
                showLastValidated: true
            });
            expect(children).toContain('Based on the latest validation recorded for this value.');
            expect(children).toContain('Last validated:');
        });

        it('does not render timestamp text when lastValidatedAt is absent', () => {
            const children = getChildrenStr({
                source: { type: 'USER_INPUT' }, // No lastValidatedAt
                showLastValidated: true
            });
            expect(children).not.toContain('Last validated:');
        });

        it('existing scalar-field timestamp behaviour remains unchanged (shows when true, hides when false)', () => {
            const source = { type: 'USER_INPUT', lastValidatedAt: mockLastValidatedAt };

            const withTimestamp = getChildrenStr({ source, showLastValidated: true });
            expect(withTimestamp).toContain('Last validated:');

            const withoutTimestamp = getChildrenStr({ source, showLastValidated: false });
            expect(withoutTimestamp).not.toContain('Last validated:');
        });
    });
});
});
