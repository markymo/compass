import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '@/lib/prisma';
import { ensureNotReferenceSnapshot, ensureQuestionNotReferenceSnapshot } from '@/actions/questionnaire';

vi.mock('@/lib/prisma', () => ({
    default: {
        questionnaire: { findUnique: vi.fn() },
        question: { findUnique: vi.fn() }
    }
}));

vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: 'user-001' }),
}));

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}));

const prismaMock = prisma as any;

describe('Questionnaire Lifecycle Guardrails', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('blocks mutations on REFERENCE_SNAPSHOT', async () => {
        prismaMock.questionnaire.findUnique.mockResolvedValue({
            kind: "REFERENCE_SNAPSHOT",
            isGlobal: true,
            isTemplate: true,
            fiEngagementId: null
        });

        await expect(ensureNotReferenceSnapshot('ref-123')).rejects.toThrow('REFERENCE_SNAPSHOT_LOCKED');
    });

    it('allows mutations on WORKING_COPY', async () => {
        prismaMock.questionnaire.findUnique.mockResolvedValue({
            kind: "WORKING_COPY",
            isGlobal: false,
            isTemplate: true,
            fiEngagementId: null
        });

        await expect(ensureNotReferenceSnapshot('wc-123')).resolves.not.toThrow();
    });

    it('allows mutations on ENGAGEMENT_QUESTIONNAIRE', async () => {
        prismaMock.questionnaire.findUnique.mockResolvedValue({
            kind: "ENGAGEMENT_QUESTIONNAIRE",
            isGlobal: false,
            isTemplate: false,
            fiEngagementId: 'eng-123'
        });

        await expect(ensureNotReferenceSnapshot('eq-123')).resolves.not.toThrow();
    });

    it('blocks question-level mutations on REFERENCE_SNAPSHOT', async () => {
        prismaMock.question.findUnique.mockResolvedValue({
            questionnaireId: 'ref-123'
        });
        prismaMock.questionnaire.findUnique.mockResolvedValue({
            kind: "REFERENCE_SNAPSHOT",
            isGlobal: true,
            isTemplate: true,
            fiEngagementId: null
        });

        await expect(ensureQuestionNotReferenceSnapshot('q-123')).rejects.toThrow('REFERENCE_SNAPSHOT_LOCKED');
    });

    it('allows question-level mutations on WORKING_COPY', async () => {
        prismaMock.question.findUnique.mockResolvedValue({
            questionnaireId: 'wc-123'
        });
        prismaMock.questionnaire.findUnique.mockResolvedValue({
            kind: "WORKING_COPY",
            isGlobal: false,
            isTemplate: true,
            fiEngagementId: null
        });

        await expect(ensureQuestionNotReferenceSnapshot('q-wc-123')).resolves.not.toThrow();
    });
});
