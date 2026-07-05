import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyMasterToQuestion } from '../kyc-propagation';

// Mock dependencies
vi.mock('@/lib/prisma', () => {
    return {
        default: {
            question: {
                findUnique: vi.fn(),
                update: vi.fn()
            },
            questionActivity: {
                create: vi.fn()
            }
        }
    };
});

vi.mock('../questionnaire', () => ({
    ensureQuestionNotReferenceSnapshot: vi.fn().mockResolvedValue(true)
}));

vi.mock('../kyc-query', () => ({
    getFieldDetail: vi.fn()
}));

import prisma from '@/lib/prisma';
import { getFieldDetail } from '../kyc-query';

describe('kyc-propagation applyMasterToQuestion Smoke Test', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('propagates a structured code list and resolves to a semicolon-separated string via toExportText', async () => {
        // Setup mocks
        (prisma.question.findUnique as any).mockResolvedValue({
            id: 'q-123',
            masterFieldNo: 63,
            questionnaire: {
                fiEngagement: { clientLEId: 'client-456' }
            }
        });

        (getFieldDetail as any).mockResolvedValue({
            dataType: 'COMPLEX',
            profileConfig: { codeSystem: 'DIRECTOR_ROLES' } // hypothetical config
        });

        // The incoming master data value
        const incomingStructuredValue = [
            { code: 'DIR', label: 'Director' },
            { code: 'SHR', label: 'Shareholder' }
        ];

        // Execute
        const result = await applyMasterToQuestion(
            'q-123',
            incomingStructuredValue,
            'user-789'
        );

        expect(result.success).toBe(true);

        // Verify the correctly formatted string was written to the DB
        expect(prisma.question.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'q-123' },
                data: expect.objectContaining({
                    answer: 'Director; Shareholder', // The intentional improvement!
                    status: 'DRAFT'
                })
            })
        );
    });

    it('propagates a scalar boolean successfully', async () => {
        (prisma.question.findUnique as any).mockResolvedValue({
            id: 'q-124',
            masterFieldNo: 15,
            questionnaire: {
                fiEngagement: { clientLEId: 'client-456' }
            }
        });

        (getFieldDetail as any).mockResolvedValue({
            dataType: 'BOOLEAN',
            profileConfig: null
        });

        await applyMasterToQuestion('q-124', true, 'user-789');

        expect(prisma.question.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    answer: 'Yes',
                })
            })
        );
    });
});
