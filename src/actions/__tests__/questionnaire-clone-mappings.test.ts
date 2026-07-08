import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import prisma from '@/lib/prisma';
import { addToReferenceLibrary } from '../questionnaires-v2';
import { assignQuestionnaireToEngagement, saveQuestionnaireChanges } from '../questionnaire';

// Mock security and auth
vi.mock('@/actions/security', () => ({
    isSystemAdmin: vi.fn().mockResolvedValue(true),
}));
vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: 'test-user-id' }),
}));
vi.mock('@/lib/auth/permissions', () => ({
    can: vi.fn().mockResolvedValue(true),
    Action: {
        CREATE_REFERENCE_SNAPSHOT: 'CREATE_REFERENCE_SNAPSHOT',
        EDIT_QUESTIONNAIRE: 'EDIT_QUESTIONNAIRE',
        ASSIGN_QUESTIONNAIRE: 'ASSIGN_QUESTIONNAIRE',
    },
}));
vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
    unstable_noStore: vi.fn(),
}));

describe.skipIf(!process.env.DATABASE_URL)('Questionnaire mapping clone/persistence', () => {
    let fiOrgId: string;
    let templateId: string;
    let engagementId: string;

    beforeAll(async () => {
        // Create test FI org
        const rand = Math.floor(Math.random() * 100000);
        const org = await prisma.organization.create({
            data: { name: `Test FI Org Mapping Clone ${rand}`, types: ['FI'], shortCode: `FIMAPCLONE_${rand}` },
        });
        fiOrgId = org.id;

        // Create a Client LE and Engagement
        const clientLE = await prisma.clientLE.create({
            data: { name: `Test Client LE ${rand}` },
        });
        const engagement = await prisma.fIEngagement.create({
            data: { fiOrgId, clientLEId: clientLE.id, status: 'CONNECTED' },
        });
        engagementId = engagement.id;

        // Create a Working Copy questionnaire with mappings
        const template = await prisma.questionnaire.create({
            data: {
                fiOrgId,
                name: 'Working Copy for Mapping Test',
                status: 'ACTIVE',
                kind: 'WORKING_COPY',
                isTemplate: true,
                extractedContent: [] as any,
                questions: {
                    create: [
                        {
                            text: 'Q1 with mappings',
                            order: 1,
                            masterFieldNo: 123,
                            masterFieldProjectionPath: 'addressLines[1]',
                            approvedMappingConfig: { confidence: 0.95 },
                            expectedDataType: 'STRING',
                        },
                    ],
                },
            },
            include: { questions: true },
        });
        templateId = template.id;
    });

    afterAll(async () => {
        if (fiOrgId) {
            await prisma.questionnaire.deleteMany({ where: { fiOrgId } });
            await prisma.fIEngagement.deleteMany({ where: { fiOrgId } });
            await prisma.organization.delete({ where: { id: fiOrgId } });
        }
    });

    it('addToReferenceLibrary preserves full mapping payload (Working Copy -> Reference Snapshot)', async () => {
        const res = await addToReferenceLibrary(templateId, 'Ref Snapshot Mapping Test', 'REFMAP');
        expect(res.success).toBe(true);

        // Fetch newly created Reference Snapshot questions
        const refSnapshot = await prisma.questionnaire.findUnique({
            where: { id: res.referenceId },
            include: { questions: true },
        });

        expect(refSnapshot).toBeDefined();
        expect(refSnapshot?.kind).toBe('REFERENCE_SNAPSHOT');
        expect(refSnapshot?.questions.length).toBe(1);

        const q = refSnapshot!.questions[0];
        expect(q.masterFieldNo).toBe(123);
        expect(q.masterFieldProjectionPath).toBe('addressLines[1]');
        expect(q.approvedMappingConfig).toEqual({ confidence: 0.95 });
        expect(q.expectedDataType).toBe('STRING');
    });

    it('saveQuestionnaireChanges (syncQuestionsToDatabase) preserves mappings', async () => {
        // Create an empty questionnaire
        const qToUpdate = await prisma.questionnaire.create({
            data: {
                fiOrgId,
                name: 'Save Test Questionnaire',
                status: 'ACTIVE',
                kind: 'WORKING_COPY',
            },
        });

        // Mock payload from UI
        const itemsToSave = [
            {
                type: 'question',
                text: 'Updated Q1',
                order: 1,
                masterFieldNo: 456,
                masterFieldProjectionPath: 'locality',
                approvedMappingConfig: { autoMapped: true },
                expectedDataType: 'STRING',
            },
        ];

        const saveRes = await saveQuestionnaireChanges(qToUpdate.id, itemsToSave);
        expect(saveRes.success).toBe(true);

        const updatedQ = await prisma.questionnaire.findUnique({
            where: { id: qToUpdate.id },
            include: { questions: true },
        });

        expect(updatedQ?.questions.length).toBe(1);
        const savedQ = updatedQ!.questions[0];
        expect(savedQ.masterFieldNo).toBe(456);
        expect(savedQ.masterFieldProjectionPath).toBe('locality');
        expect(savedQ.approvedMappingConfig).toEqual({ autoMapped: true });
        
        // Also verify the extractedContent was updated (as the UI expects for backward compatibility)
        expect(Array.isArray(updatedQ?.extractedContent)).toBe(true);
    });

    it('assignQuestionnaireToEngagement preserves full mapping payload', async () => {
        const res = await assignQuestionnaireToEngagement(templateId, engagementId);
        expect(res.success).toBe(true);

        // Fetch newly created Engagement Questionnaire
        const engagementQ = await prisma.questionnaire.findUnique({
            where: { id: res.id },
            include: { questions: true },
        });

        expect(engagementQ).toBeDefined();
        expect(engagementQ?.kind).toBe('ENGAGEMENT_QUESTIONNAIRE');
        expect(engagementQ?.questions.length).toBe(1);

        const q = engagementQ!.questions[0];
        expect(q.masterFieldNo).toBe(123);
        expect(q.masterFieldProjectionPath).toBe('addressLines[1]');
        expect(q.approvedMappingConfig).toEqual({ confidence: 0.95 });
    });
});
