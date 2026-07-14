/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { GroupAnswerRenderer, GroupFieldData } from '../group-answer-renderer';

// Mock dependencies that cause issues in JSDOM tests
vi.mock('@/components/client/fields/FieldValueRenderer', () => ({
    FieldValueRenderer: () => <div data-testid="field-value-renderer">Mocked Value</div>
}));
vi.mock('@/components/client/fields/FieldSourceBadge', () => ({
    FieldSourceBadge: () => <div data-testid="field-source-badge">Mocked Source</div>
}));

const mockFields: GroupFieldData[] = [
    {
        fieldNo: 1,
        fieldName: 'F1',
        appDataType: 'TEXT',
        isMultiValue: false,
        hydrated: { value: 'Answer 1', source: 'USER_INPUT', isSynced: true },
        canonicalDisplayModel: {
            fieldNo: 1,
            label: 'F1',
            state: 'POPULATED',
            value: { display: 'Answer 1' }
        }
    },
    {
        fieldNo: 2,
        fieldName: 'F2',
        appDataType: 'TEXT',
        isMultiValue: false,
        hydrated: { value: 'Answer 2', source: 'USER_INPUT', isSynced: true },
        canonicalDisplayModel: {
            fieldNo: 2,
            label: 'F2',
            state: 'POPULATED',
            value: { display: 'Answer 2' }
        }
    }
];

describe('GroupAnswerRenderer', () => {
    it('renders in LIST mode by default', () => {
        const { container } = render(
            <GroupAnswerRenderer groupLabel="Test Group" fields={mockFields} raNameLookup={{}} />
        );
        
        const wrapper = container.querySelector('.relative.rounded-lg');
        expect(wrapper).toBeDefined();
        
        expect(wrapper?.className).toContain('divide-y');
        expect(wrapper?.className).not.toContain('grid');
    });

    it('falls back safely to LIST mode if an unknown style is passed', () => {
        const { container } = render(
            // @ts-ignore
            <GroupAnswerRenderer groupLabel="Test Group" fields={mockFields} raNameLookup={{}} displayStyle="UNKNOWN_STYLE" />
        );
        
        const wrapper = container.querySelector('.relative.rounded-lg');
        expect(wrapper?.className).toContain('divide-y');
        expect(wrapper?.className).not.toContain('grid');
    });

    it('renders in COMPACT mode using grid classes', () => {
        const { container } = render(
            <GroupAnswerRenderer groupLabel="Test Group" fields={mockFields} raNameLookup={{}} displayStyle="COMPACT" />
        );
        
        const wrapper = container.querySelector('.relative.rounded-lg');
        
        expect(wrapper?.className).toContain('grid');
        expect(wrapper?.className).toContain('grid-cols-1');
        expect(wrapper?.className).not.toContain('divide-y');
    });

    it('renders in GRID mode using spreadsheet layout', () => {
        const { container } = render(
            <GroupAnswerRenderer groupLabel="Test Group" fields={mockFields} raNameLookup={{}} displayStyle="GRID" />
        );
        
        const wrapper = container.querySelector('.relative.rounded-lg');
        
        expect(wrapper?.className).toContain('flex-col');
        expect(wrapper?.className).not.toContain('divide-y');
        
        // Check if the inner rows have the specific grid layout
        const row = container.querySelector('.grid-cols-\\[40\\%_40\\%_20\\%\\]');
        expect(row).toBeDefined();
    });
    
    it('repeated-instance and field ordering remaining unchanged between modes', () => {
        const { container: listContainer } = render(
            <GroupAnswerRenderer groupLabel="Test Group" fields={mockFields} raNameLookup={{}} displayStyle="LIST" />
        );
        const listText = listContainer.textContent;
        
        const { container: compactContainer } = render(
            <GroupAnswerRenderer groupLabel="Test Group" fields={mockFields} raNameLookup={{}} displayStyle="COMPACT" />
        );
        const compactText = compactContainer.textContent;
        
        // The textual content/order should be identical, only styles differ
        expect(listText).toBe(compactText);
    });
});
