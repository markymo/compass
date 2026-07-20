import { describe, it, expect } from 'vitest';
import { QuestionnairePDF } from '../questionnaire-pdf';
import React from 'react';

describe('QuestionnairePDF', () => {
    
    // helper to find text in tree
    const findText = (node: any, text: string): boolean => {
        if (!node) return false;
        if (typeof node === 'string' || typeof node === 'number') return String(node).includes(text);
        if (Array.isArray(node)) return node.some(n => findText(n, text));
        if (node.props && node.props.children) return findText(node.props.children, text);
        return false;
    };

    // better helper to find GroupFieldSourceBadge by looking at the type or props
    const findBadge = (node: any, sourceLabel: string): boolean => {
        if (!node) return false;
        if (Array.isArray(node)) return node.some(n => findBadge(n, sourceLabel));
        if (node.type?.name === 'GroupFieldSourceBadge') {
            return node.props.sourceLabel === sourceLabel;
        }
        if (node.props && node.props.children) return findBadge(node.props.children, sourceLabel);
        return false;
    };

    it('renders LIST group field with a source', () => {
        const data = [{
            id: '1',
            status: 'VERIFIED',
            question: 'List Group Q',
            answer: 'Group data',
            groupDisplayStyle: 'LIST' as const,
            groupFields: [{
                fieldNo: 1,
                label: 'Field 1',
                displayValue: 'Val 1',
                order: 1,
                sourceLabel: 'Companies House'
            }]
        }];
        
        const element = QuestionnairePDF({ title: 'Test PDF', data });
        expect(findBadge(element, 'Companies House')).toBe(true);
    });

    it('renders COMPACT group field with a source', () => {
        const data = [{
            id: '1',
            status: 'VERIFIED',
            question: 'Compact Group Q',
            answer: 'Group data',
            groupDisplayStyle: 'COMPACT' as const,
            groupFields: [{
                fieldNo: 1,
                label: 'Field 1',
                displayValue: 'Val 1',
                order: 1,
                sourceLabel: 'User Input'
            }]
        }];
        
        const element = QuestionnairePDF({ title: 'Test PDF', data });
        expect(findBadge(element, 'User Input')).toBe(true);
    });
    
    it('renders field without a source', () => {
        const data = [{
            id: '1',
            status: 'VERIFIED',
            question: 'Compact Group Q',
            answer: 'Group data',
            groupDisplayStyle: 'COMPACT' as const,
            groupFields: [{
                fieldNo: 1,
                label: 'Field 1',
                displayValue: 'Val 1',
                order: 1
            }]
        }];
        
        const element = QuestionnairePDF({ title: 'Test PDF', data });
        expect(findBadge(element, 'User Input')).toBe(false);
        expect(findText(element, 'Val 1')).toBe(true);
    });

    it('renders multiple group fields with different sources', () => {
        const data = [{
            id: '1',
            status: 'VERIFIED',
            question: 'List Group Q',
            answer: 'Group data',
            groupDisplayStyle: 'LIST' as const,
            groupFields: [
                { fieldNo: 1, label: 'F1', displayValue: 'V1', order: 1, sourceLabel: 'Source A' },
                { fieldNo: 2, label: 'F2', displayValue: 'V2', order: 2, sourceLabel: 'Source B' }
            ]
        }];
        
        const element = QuestionnairePDF({ title: 'Test PDF', data });
        expect(findBadge(element, 'Source A')).toBe(true);
        expect(findBadge(element, 'Source B')).toBe(true);
    });

    it('preserves existing GRID behaviour remains intact', () => {
        const data = [{
            id: '1',
            status: 'VERIFIED',
            question: 'Grid Group Q',
            answer: 'Group data',
            groupDisplayStyle: 'GRID' as const,
            groupFields: [{
                fieldNo: 1,
                label: 'Field 1',
                displayValue: 'Val 1',
                order: 1,
                sourceLabel: 'Grid Source'
            }]
        }];
        
        const element = QuestionnairePDF({ title: 'Test PDF', data });
        expect(findBadge(element, 'Grid Source')).toBe(true);
    });

    it('confirms normal non-group PDF source rendering is unchanged', () => {
        const data = [{
            id: '1',
            status: 'VERIFIED',
            question: 'Normal Q',
            answer: 'Normal A',
            sourceLabel: 'Normal Source'
        }];
        
        const element = QuestionnairePDF({ title: 'Test PDF', data });
        // The normal source label is rendered as a standard Text node, not GroupFieldSourceBadge
        expect(findBadge(element, 'Normal Source')).toBe(false);
        expect(findText(element, 'Normal Source')).toBe(true);
    });
});
