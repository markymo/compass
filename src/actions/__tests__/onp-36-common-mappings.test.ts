import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cloneQuestionFields } from '@/lib/questionnaires/question-utils';

// Contract: QNR-03 — Common Questionnaire mappings appear in relationship use
// Linear: ONP-36

describe('QNR-03 / ONP-36 — Common Questionnaire Mappings Invariants', () => {
    it('1. cloneQuestionFields faithfully preserves all Master Field and Custom Field mapping attributes', () => {
        const sourceQuestion = {
            id: 'q-source-1',
            text: 'What is the full legal name of the entity?',
            compactText: 'Legal Name',
            order: 1,
            masterFieldNo: 2,
            masterQuestionGroupId: null,
            customFieldDefinitionId: null,
            masterFieldProjectionPath: null,
            approvedMappingConfig: { source: 'GLEIF', confidence: 0.95 },
            expectedDataType: 'STRING',
            allowAttachments: false,
            prefilledValue: null
        };

        const cloned = cloneQuestionFields(sourceQuestion, 'qnr-engagement-1', {
            status: 'SHARED'
        });

        expect(cloned.questionnaireId).toBe('qnr-engagement-1');
        expect(cloned.text).toBe('What is the full legal name of the entity?');
        expect(cloned.masterFieldNo).toBe(2);
        expect(cloned.approvedMappingConfig).toEqual({ source: 'GLEIF', confidence: 0.95 });
        expect(cloned.status).toBe('SHARED');
    });

    it('2. cloneQuestionFields preserves composite group and custom field mappings', () => {
        const groupQuestion = {
            text: 'Board Members details',
            order: 2,
            masterFieldNo: null,
            masterQuestionGroupId: 'group-directors',
            customFieldDefinitionId: 'custom-tax-id',
            masterFieldProjectionPath: 'directors[0].name',
            approvedMappingConfig: null
        };

        const cloned = cloneQuestionFields(groupQuestion, 'qnr-engagement-2');

        expect(cloned.masterQuestionGroupId).toBe('group-directors');
        expect(cloned.customFieldDefinitionId).toBe('custom-tax-id');
        expect(cloned.masterFieldProjectionPath).toBe('directors[0].name');
    });
});
