import { describe, it, expect } from 'vitest';
import { FieldSourceBadge, FieldSourceBadgeProps } from '../FieldSourceBadge';
import { FieldSource } from '@/lib/master-data/field-display-model';

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
    });
});
