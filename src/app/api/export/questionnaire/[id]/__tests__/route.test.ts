import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';
import { NextRequest } from 'next/server';
import { resolveQuestionnaireContext } from '@/lib/kyc/engagement-context';
import { resolveExportAnswer } from '@/lib/export/export-answer-resolver';
import prisma from '@/lib/prisma';
import { renderToStream } from '@react-pdf/renderer';
import React from 'react';

vi.mock('@/lib/kyc/engagement-context', () => ({
    resolveQuestionnaireContext: vi.fn(),
}));

vi.mock('@/lib/export/export-answer-resolver', () => ({
    resolveExportAnswer: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
    default: {
        questionnaire: {
            findUnique: vi.fn(),
        },
        question: {
            findMany: vi.fn(),
        },
        user: {
            findUnique: vi.fn(),
        }
    }
}));

vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: 'test-user-id' }),
}));

vi.mock('@react-pdf/renderer', () => ({
    renderToStream: vi.fn().mockResolvedValue({
        pipe: vi.fn(),
        on: vi.fn(),
    }),
}));

// Mock the QuestionnairePDF component so we don't need real React-PDF rendering
vi.mock('@/components/pdf/questionnaire-pdf', () => ({
    QuestionnairePDF: () => null,
}));

describe('Export API Route', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('successfully resolves an M2M questionnaire with mapped Standard Field 138', async () => {
        const questionnaireId = 'q-123';
        
        // Mock the resolved context for an M2M (Supplier) Engagement
        vi.mocked(resolveQuestionnaireContext).mockResolvedValue({
            questionnaire: { id: questionnaireId, name: 'M2M Supplier Questionnaire', isDeleted: false },
            engagement: { org: { name: 'Supplier Org' } },
            clientLE: { 
                id: 'client-123', 
                legalEntityId: 'le-456',
                name: 'Client Entity',
                owners: [{ party: { name: 'Parent Org' } }]
            },
            clientLeId: 'client-123',
            subjectLeId: 'le-456',
            ownerScopeId: 'scope-789'
        } as any);

        // Mock the questions to include a mapped Standard Field 138
        const mockQuestions = [
            {
                id: 'question-1',
                questionnaireId,
                text: 'Registered Address',
                masterFieldNo: 138,
                status: 'RELEASED',
                order: 1,
                documents: [],
                comments: []
            }
        ];
        vi.mocked(prisma.question.findMany).mockResolvedValue(mockQuestions as any);

        // Mock the answer resolver to return a successfully resolved address
        vi.mocked(resolveExportAnswer).mockResolvedValue({
            displayValue: "123 M2M Street, London, UK",
            rawValue: { ccAddressId: 'addr-xyz' },
            answerState: "HAS_VALUE",
            sourceCategory: "GLEIF"
        });

        const req = new NextRequest(`http://localhost/api/export/questionnaire/${questionnaireId}`);
        const response = await GET(req, { params: Promise.resolve({ id: questionnaireId }) } as any);

        // Since we mocked renderToStream, the response will be a 200 OK with a ReadableStream
        expect(response.status).toBe(200);

        // Verify that the helper was called with the right ID
        expect(resolveQuestionnaireContext).toHaveBeenCalledWith(questionnaireId);

        // Verify that resolveExportAnswer was called with the correct subjectLeId resolved from the M2M engagement!
        expect(resolveExportAnswer).toHaveBeenCalledWith(
            mockQuestions[0],
            'le-456', // subjectLeId successfully passed
            'scope-789', // ownerScopeId successfully passed
            'client-123' // entityId successfully passed
        );
    });
});
