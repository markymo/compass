import { describe, it, expect, vi } from 'vitest';
import { CollectionRenderer } from '../CollectionRenderer';

vi.mock('../FieldValueRenderer', () => ({
    FieldValueRenderer: (props: any) => {
        return <div data-testid="mock-field-value-renderer">{props.field.value.display || props.field.value.kind}</div>;
    }
}));

describe('CollectionRenderer', () => {
    it('renders list layout for scalar items', () => {
        const items = [
            { value: { kind: 'scalar', display: 'A', rawValue: 'A' } },
            { value: { kind: 'scalar', display: 'B', rawValue: 'B' } }
        ] as any[];

        const element: any = CollectionRenderer({ items, fieldSource: null, collectionLayout: 'inline' });
        
        expect(element?.type).toBe('ul');
        
        const children = element?.props?.children;
        const visibleItems = children[0]; // first part of children array is the map
        expect(visibleItems).toHaveLength(2);
        
        // Item 0
        const fragment0 = visibleItems[0].props.children;
        expect(fragment0.props.children.props.field.value.display).toBe('A');
        
        // Item 1
        const fragment1 = visibleItems[1].props.children;
        expect(fragment1.props.children.props.field.value.display).toBe('B');
    });

    it('renders block layout with top header and truncation', () => {
        const items = Array.from({ length: 20 }).map((_, i) => ({
            value: { kind: 'scalar', display: `Item ${i}`, rawValue: `Item ${i}` }
        })) as any[];

        const element: any = CollectionRenderer({ items, fieldSource: null, collectionLayout: 'block', itemLimit: 18 });
        
        expect(element?.type).toBe('div');
        expect(element?.props?.className).toContain('flex-col');
        
        const children = element?.props?.children;
        
        // Header
        const header = children[0];
        expect(header.props.children[0].props.children).toEqual([20, ' Items']);
        
        // List container
        const list = children[1];
        expect(list.props.children).toHaveLength(18); // Truncated to 18
        
        // Truncation message
        const truncationMsg = children[2];
        expect(truncationMsg.props.children).toContain(2); // "+ 2 more"
    });

    it('suppresses per-item source badges for this phase', () => {
        const items = [
            { 
                value: { kind: 'scalar', display: 'A', rawValue: 'A' },
                source: { label: 'Source A', colorKey: 'SYSTEM', type: 'SYS', category: 'SYSTEM' }
            }
        ] as any[];

        const element: any = CollectionRenderer({ items, fieldSource: null, collectionLayout: 'inline' });
        
        const visibleItems = element?.props?.children[0];
        const itemContainer = visibleItems[0];
        const fragment = itemContainer.props.children;
        
        // The fragment is a React.Fragment containing FieldValueRenderer.
        expect(Array.isArray(fragment.props.children)).toBe(false);
        expect(fragment.props.children.type.name || fragment.props.children.type.displayName || fragment.props.children.type).not.toBe('FieldSourceBadge');
    });
});
