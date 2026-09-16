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

    // Helper to collect all leaf text strings in the element tree
    const collectAllText = (node: any): string[] => {
        if (!node) return [];
        if (typeof node === 'string' || typeof node === 'number') return [String(node)];
        if (Array.isArray(node)) return node.flatMap(n => collectAllText(n));
        if (node.props && node.props.children) return collectAllText(node.props.children);
        return [];
    };

    // Helper to count occurrences of a string across all leaf text nodes
    const countTextOccurrences = (node: any, match: string): number => {
        const texts = collectAllText(node);
        let count = 0;
        for (const t of texts) {
            let pos = 0;
            while ((pos = t.indexOf(match, pos)) !== -1) {
                count++;
                pos += match.length;
            }
        }
        return count;
    };

    const findBadge = (node: any, sourceLabel: string, sourceTimestamp?: string): boolean => {
        if (!node) return false;
        if (Array.isArray(node)) return node.some(n => findBadge(n, sourceLabel, sourceTimestamp));
        if (node.type?.name === 'GroupFieldSourceBadge') {
            const labelMatch = node.props.sourceLabel === sourceLabel;
            if (sourceTimestamp !== undefined) {
                return labelMatch && node.props.sourceTimestamp === sourceTimestamp;
            }
            return labelMatch;
        }
        if (node.props && node.props.children) return findBadge(node.props.children, sourceLabel, sourceTimestamp);
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

    it('renders sourceTimestamp for group fields using formatSystemDateTime', () => {
        const testDate = '2026-07-20T12:00:00Z';
        const data = [{
            id: '1',
            status: 'VERIFIED',
            question: 'Group Q',
            answer: 'Group data',
            groupDisplayStyle: 'LIST' as const,
            groupFields: [{
                fieldNo: 1,
                label: 'Field 1',
                displayValue: 'Val 1',
                order: 1,
                sourceLabel: 'Source',
                sourceTimestamp: testDate
            }]
        }];
        
        const element = QuestionnairePDF({ title: 'Test PDF', exportMetadata: { timezone: 'UTC', exportId: '123' } as any, data });
        expect(findBadge(element, 'Source', testDate)).toBe(true);
    });

    describe('ONP-200: Questionnaire answers without "Answer:" prefix', () => {
        it('renders single-value answer directly without "Answer:" prefix', () => {
            const data = [{
                id: '1',
                status: 'VERIFIED',
                question: 'Redemption cycle (hedge / PE funds only)',
                answer: 'Not applicable'
            }];

            const element = QuestionnairePDF({ title: 'Test PDF', data });

            // Must NOT contain literal "Answer:" prefix
            expect(countTextOccurrences(element, 'Answer:')).toBe(0);
            expect(countTextOccurrences(element, 'Answer: ')).toBe(0);

            // Response value must render cleanly
            expect(findText(element, 'Not applicable')).toBe(true);
            expect(countTextOccurrences(element, 'Not applicable')).toBe(1);
        });

        it('renders multiline/multi-value answer cleanly without "Answer:" prefix', () => {
            const multiValueAnswer = 'Director One\nDirector Two\nDirector Three';
            const data = [{
                id: '1',
                status: 'VERIFIED',
                question: 'Current Active Directors',
                answer: multiValueAnswer
            }];

            const element = QuestionnairePDF({ title: 'Test PDF', data });

            expect(countTextOccurrences(element, 'Answer:')).toBe(0);
            expect(countTextOccurrences(element, 'Answer: ')).toBe(0);
            expect(findText(element, multiValueAnswer)).toBe(true);
        });

        it('renders fallback "No response recorded" cleanly without "Answer:" prefix', () => {
            const data = [{
                id: '1',
                status: 'DRAFT',
                question: 'Unanswered Question',
                answer: ''
            }];

            const element = QuestionnairePDF({ title: 'Test PDF', data });

            expect(countTextOccurrences(element, 'Answer:')).toBe(0);
            expect(findText(element, 'No response recorded')).toBe(true);
            expect(countTextOccurrences(element, 'No response recorded')).toBe(1);
        });
    });

    describe('ONP-201: Attachments rendering without duplicates or legacy Evidence terminology', () => {
        it('renders one attachment filename exactly once under canonical Attachments header', () => {
            const data = [{
                id: '1',
                status: 'VERIFIED',
                question: 'Certificate of Incorporation',
                answer: 'Document attached',
                attachmentFilenames: ['cert_of_incorporation.pdf']
            }];

            const element = QuestionnairePDF({ title: 'Test PDF', data });

            // Canonical Attachments header appears exactly once
            expect(countTextOccurrences(element, 'Attachments')).toBe(1);

            // Filename appears exactly once
            expect(countTextOccurrences(element, 'cert_of_incorporation.pdf')).toBe(1);

            // Deprecated evidence terminology and emoji must NOT appear anywhere
            expect(countTextOccurrences(element, 'Evidence Attached:')).toBe(0);
            expect(countTextOccurrences(element, 'Evidence Attached')).toBe(0);
            expect(countTextOccurrences(element, 'Evidence')).toBe(0);
            expect(countTextOccurrences(element, '📄')).toBe(0);
        });

        it('renders multiple attachment filenames each exactly once under a single Attachments header', () => {
            const data = [{
                id: '1',
                status: 'VERIFIED',
                question: 'Identity Documentation',
                answer: 'Documents attached',
                attachmentFilenames: ['passport.pdf', 'utility_bill.pdf']
            }];

            const element = QuestionnairePDF({ title: 'Test PDF', data });

            expect(countTextOccurrences(element, 'Attachments')).toBe(1);
            expect(countTextOccurrences(element, 'passport.pdf')).toBe(1);
            expect(countTextOccurrences(element, 'utility_bill.pdf')).toBe(1);

            expect(countTextOccurrences(element, 'Evidence Attached:')).toBe(0);
            expect(countTextOccurrences(element, 'Evidence')).toBe(0);
            expect(countTextOccurrences(element, '📄')).toBe(0);
        });

        it('does not render Attachments section when question has no attachments', () => {
            const data = [{
                id: '1',
                status: 'VERIFIED',
                question: 'Legal Name',
                answer: 'Acme Corporation Ltd',
                attachmentFilenames: []
            }];

            const element = QuestionnairePDF({ title: 'Test PDF', data });

            expect(countTextOccurrences(element, 'Attachments')).toBe(0);
            expect(countTextOccurrences(element, 'Evidence')).toBe(0);
            expect(countTextOccurrences(element, '📄')).toBe(0);
        });

        it('renders group-field attachmentFilenames under Attachments without Evidence or emoji', () => {
            const data = [{
                id: '1',
                status: 'VERIFIED',
                question: 'Group Field Question',
                answer: 'Group data',
                groupDisplayStyle: 'LIST' as const,
                groupFields: [{
                    fieldNo: 1,
                    label: 'Proof of Address',
                    displayValue: 'Attached',
                    order: 1,
                    sourceLabel: 'Master Data attachment',
                    attachmentFilenames: ['proof_of_address.pdf']
                }]
            }];

            const element = QuestionnairePDF({ title: 'Test PDF', data });

            expect(countTextOccurrences(element, 'Attachments')).toBe(1);
            expect(countTextOccurrences(element, 'proof_of_address.pdf')).toBe(1);
            expect(countTextOccurrences(element, 'Evidence')).toBe(0);
            expect(countTextOccurrences(element, '📄')).toBe(0);
        });
    });
});
