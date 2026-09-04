import { describe, it, expect, afterAll, beforeAll, vi } from 'vitest';
import prisma from '@/lib/prisma';
import { generateSupersetWorkingCopy } from '@/lib/questionnaires/superset-generator';
import * as questionSync from '@/lib/questionnaires/question-sync';
import { getQuestionnairesV2 } from '../questionnaires-v2';

// Mock auth so getQuestionnairesV2 returns admin view in tests
vi.mock('@/actions/security', () => ({
    isSystemAdmin: vi.fn().mockResolvedValue(true),
}));
vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: 'test-admin-id' }),
}));
vi.mock('@/lib/auth/permissions', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/auth/permissions')>();
    return {
        ...actual,
        can: vi.fn().mockResolvedValue(true),
        ensureAuthorization: vi.fn().mockResolvedValue(undefined as any),
    };
});

describe.skipIf(!process.env.DATABASE_URL)('ONP-187 Superset Working Copy Generator', () => {
    vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });
    let createdQuestionnaireId: string | null = null;

    afterAll(async () => {
        // Clean up temporary test questionnaire and linked questions
        const supersets = await prisma.questionnaire.findMany({
            where: { functionalCode: 'SUPERSET', kind: 'WORKING_COPY' },
            select: { id: true }
        });
        for (const s of supersets) {
            await prisma.question.deleteMany({
                where: { questionnaireId: s.id }
            });
            await prisma.questionnaire.delete({
                where: { id: s.id }
            }).catch(() => null);
        }
    }, 30000);

    describe('Dry Run Behaviour', () => {
        it('queries active master fields and returns proposed items without writing to database', async () => {
            const activeFields = await prisma.masterFieldDefinition.findMany({
                where: { isActive: true },
                orderBy: { fieldNo: 'asc' }
            });

            const countBefore = await prisma.questionnaire.count({
                where: { functionalCode: 'SUPERSET', kind: 'WORKING_COPY' }
            });

            const result = await generateSupersetWorkingCopy({ dryRun: true });

            expect(result.success).toBe(true);
            expect(result.dryRun).toBe(true);
            expect(result.questionCount).toBe(activeFields.length);
            expect(result.items).toHaveLength(activeFields.length);

            const countAfter = await prisma.questionnaire.count({
                where: { functionalCode: 'SUPERSET', kind: 'WORKING_COPY' }
            });
            expect(countAfter).toBe(countBefore);
        }, 30000);
    });

    describe('Core Superset Working Copy Contract', () => {
        let activeFields: Array<{ fieldNo: number; fieldName: string }>;
        let questionnaire: any;
        let questions: any[];

        beforeAll(async () => {
            activeFields = await prisma.masterFieldDefinition.findMany({
                where: { isActive: true },
                orderBy: { fieldNo: 'asc' },
                select: { fieldNo: true, fieldName: true }
            });

            // Generate working copy with force=true to ensure fresh test state
            const result = await generateSupersetWorkingCopy({ force: true });
            expect(result.success).toBe(true);
            expect(result.questionnaireId).toBeDefined();
            createdQuestionnaireId = result.questionnaireId!;

            questionnaire = await prisma.questionnaire.findUnique({
                where: { id: createdQuestionnaireId },
                include: {
                    questions: { orderBy: { order: 'asc' } }
                }
            });
            questions = questionnaire.questions;
        });

        it('1. generated masterFieldNo set exactly equals active MasterFieldDefinition.fieldNo set', () => {
            const activeFieldNos = new Set(activeFields.map(f => f.fieldNo));
            const questionFieldNos = new Set(questions.map(q => q.masterFieldNo));

            expect(questionFieldNos).toEqual(activeFieldNos);
        });

        it('2. exactly one Question per active field', () => {
            expect(questions.length).toBe(activeFields.length);
        });

        it('3. no duplicates', () => {
            const questionFieldNos = questions.map(q => q.masterFieldNo);
            const uniqueFieldNos = new Set(questionFieldNos);

            expect(uniqueFieldNos.size).toBe(questions.length);
        });

        it('4. no inactive fields', async () => {
            const inactiveFields = await prisma.masterFieldDefinition.findMany({
                where: { isActive: false },
                select: { fieldNo: true }
            });
            const inactiveFieldNos = new Set(inactiveFields.map(f => f.fieldNo));

            for (const q of questions) {
                expect(inactiveFieldNos.has(q.masterFieldNo)).toBe(false);
            }
        });

        it('5. deterministic ascending fieldNo order', () => {
            for (let i = 0; i < questions.length; i++) {
                expect(questions[i].order).toBe(i + 1);
                expect(questions[i].masterFieldNo).toBe(activeFields[i].fieldNo);
                expect(questions[i].text).toBe(activeFields[i].fieldName);
            }
        });

        it('6. every generated question has direct masterFieldNo mapping', () => {
            for (const q of questions) {
                expect(q.masterFieldNo).not.toBeNull();
                expect(typeof q.masterFieldNo).toBe('number');
            }
        });

        it('7. every generated question has masterQuestionGroupId = null', () => {
            for (const q of questions) {
                expect(q.masterQuestionGroupId).toBeNull();
            }
        });

        it('8. Question rows and Questionnaire.extractedContent remain in parity', () => {
            const ext = questionnaire.extractedContent as any[];
            expect(Array.isArray(ext)).toBe(true);
            expect(ext.length).toBe(questions.length);

            for (let i = 0; i < questions.length; i++) {
                expect(ext[i].masterFieldNo).toBe(questions[i].masterFieldNo);
                expect(ext[i].text).toBe(questions[i].text);
                expect(ext[i].order).toBe(questions[i].order);
                expect(ext[i].masterQuestionGroupId).toBeNull();
            }
        });

        it('9. appears as a normal Questionnaire V2 Working Copy', async () => {
            expect(questionnaire.kind).toBe('WORKING_COPY');
            expect(questionnaire.isGlobal).toBe(false);
            expect(questionnaire.isTemplate).toBe(true);
            expect(questionnaire.functionalCode).toBe('SUPERSET');
            expect(questionnaire.name).toMatch(/^SUPERSET_UNPUBLISHED_ONPRO_/);

            const v2Data = await getQuestionnairesV2();
            const found = v2Data.workingCopies.find(wc => wc.id === questionnaire.id);
            expect(found).toBeDefined();
            expect(found?.questionCount).toBe(activeFields.length);
        });

        it('10. rerunning normally does not create a duplicate persistent SUPERSET Working Copy', async () => {
            const secondRun = await generateSupersetWorkingCopy({ force: false });

            expect(secondRun.success).toBe(true);
            expect(secondRun.questionnaireId).toBe(createdQuestionnaireId);
            expect(secondRun.isExisting).toBe(true);

            const totalSupersets = await prisma.questionnaire.count({
                where: {
                    functionalCode: 'SUPERSET',
                    kind: 'WORKING_COPY',
                    isDeleted: false
                }
            });
            expect(totalSupersets).toBe(1);
        });
    });

    describe('Atomic Creation and Replacement Failure Modes', () => {
        it('leaves no partial SUPERSET questionnaire if question synchronisation fails during creation', async () => {
            // Ensure clean state: no SUPERSET exists
            const existingSupersets = await prisma.questionnaire.findMany({
                where: { functionalCode: 'SUPERSET', kind: 'WORKING_COPY' },
                select: { id: true }
            });
            for (const s of existingSupersets) {
                await prisma.question.deleteMany({ where: { questionnaireId: s.id } });
                await prisma.questionnaire.delete({ where: { id: s.id } }).catch(() => null);
            }

            const syncSpy = vi.spyOn(questionSync, 'syncQuestionsToDatabase').mockRejectedValueOnce(
                new Error('Simulated sync error during creation')
            );

            const result = await generateSupersetWorkingCopy({ force: true });
            expect(result.success).toBe(false);

            // In an atomic transaction, the created questionnaire MUST be rolled back
            const partial = await prisma.questionnaire.findFirst({
                where: { functionalCode: 'SUPERSET', kind: 'WORKING_COPY' }
            });
            expect(partial).toBeNull();

            syncSpy.mockRestore();
        });

        it('retains original valid Working Copy and questions intact if replacement fails during --force', async () => {
            // First, create a valid initial SUPERSET Working Copy
            const initial = await generateSupersetWorkingCopy({ force: true });
            expect(initial.success).toBe(true);
            const initialId = initial.questionnaireId!;

            const initialQuestions = await prisma.question.findMany({
                where: { questionnaireId: initialId },
                orderBy: { order: 'asc' }
            });
            expect(initialQuestions.length).toBeGreaterThan(0);

            // Now attempt force-replace, but simulate failure during sync
            const syncSpy = vi.spyOn(questionSync, 'syncQuestionsToDatabase').mockRejectedValueOnce(
                new Error('Simulated sync error during force replacement')
            );

            const failedResult = await generateSupersetWorkingCopy({ force: true });
            expect(failedResult.success).toBe(false);

            // In an atomic transaction, the rollback MUST restore the original questionnaire and questions
            const preserved = await prisma.questionnaire.findUnique({
                where: { id: initialId },
                include: { questions: { orderBy: { order: 'asc' } } }
            });
            expect(preserved).not.toBeNull();
            expect(preserved?.id).toBe(initialId);
            expect(preserved?.questions.length).toBe(initialQuestions.length);

            syncSpy.mockRestore();

            // Clean up the created questionnaire
            await prisma.question.deleteMany({ where: { questionnaireId: initialId } });
            await prisma.questionnaire.delete({ where: { id: initialId } }).catch(() => null);
        });
    });
});
