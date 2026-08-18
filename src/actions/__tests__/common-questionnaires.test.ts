import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import prisma from '@/lib/prisma';
import { getAvailableCommonQuestionnaires, addCommonQuestionnaire, removeCommonQuestionnaire } from '../client-le';

vi.mock('@/actions/security', () => ({
    isSystemAdmin: vi.fn().mockResolvedValue(true),
}));
vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: 'test-user-id' }),
}));
vi.mock('@/lib/auth/permissions', () => ({
    ensureAuthorization: vi.fn().mockResolvedValue(true),
    can: vi.fn().mockReturnValue(true),
    Action: { LE_VIEW_MASTER_DATA: 'LE_VIEW_MASTER_DATA' },
}));
vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
    unstable_noStore: vi.fn(),
}));

describe.skipIf(!process.env.DATABASE_URL)('Common Questionnaires Action Unit Tests', () => {
    let testOrgId: string;
    let testLeId: string;
    let testLeWithoutOwnerId: string;
    let snapshotId: string;

    beforeAll(async () => {
        const org = await prisma.organization.create({
            data: { name: `Test Org ${Date.now()}` }
        });
        testOrgId = org.id;

        const le = await prisma.clientLE.create({
            data: {
                name: `Test LE With Owner ${Date.now()}`,
                owners: {
                    create: { partyId: testOrgId }
                }
            }
        });
        testLeId = le.id;

        const leNoOwner = await prisma.clientLE.create({
            data: {
                name: `Test LE Without Owner ${Date.now()}`
            }
        });
        testLeWithoutOwnerId = leNoOwner.id;

        const snapshot = await prisma.questionnaire.create({
            data: {
                name: "Test Global Common Questionnaire Snapshot",
                fiOrgId: testOrgId,
                kind: "REFERENCE_SNAPSHOT",
                visibility: "GLOBAL",
                status: "ACTIVE",
                referenceCode: "TEST_GLOBAL_Q_v1",
                questions: {
                    create: [
                        { text: "Question 1", order: 1 }
                    ]
                }
            }
        });
        snapshotId = snapshot.id;
    });

    afterAll(async () => {
        await prisma.questionnaire.deleteMany({
            where: {
                OR: [
                    { id: snapshotId },
                    { sourceId: snapshotId }
                ]
            }
        });
        await prisma.clientLEOwner.deleteMany({
            where: { clientLEId: { in: [testLeId, testLeWithoutOwnerId] } }
        });
        await prisma.clientLE.deleteMany({
            where: { id: { in: [testLeId, testLeWithoutOwnerId] } }
        });
        await prisma.organization.deleteMany({
            where: { id: testOrgId }
        });
    });

    it('getAvailableCommonQuestionnaires returns snapshots for LE with owner', async () => {
        const res = await getAvailableCommonQuestionnaires(testLeId);
        expect(res.success).toBe(true);
        expect(res.snapshots).toBeDefined();
        const found = res.snapshots?.find((s: any) => s.id === snapshotId);
        expect(found).toBeDefined();
    });

    it('getAvailableCommonQuestionnaires works even when LE has no active owner record in ClientLEOwner', async () => {
        const res = await getAvailableCommonQuestionnaires(testLeWithoutOwnerId);
        expect(res.success).toBe(true);
        expect(res.snapshots).toBeDefined();
        const found = res.snapshots?.find((s: any) => s.id === snapshotId);
        expect(found).toBeDefined();
    });

    it('addCommonQuestionnaire links common questionnaire to LE', async () => {
        const addRes = await addCommonQuestionnaire(testLeId, snapshotId);
        expect(addRes.success).toBe(true);

        const le = await prisma.clientLE.findUnique({
            where: { id: testLeId },
            include: { commonQuestionnaires: true }
        });
        expect(le?.commonQuestionnaires.length).toBeGreaterThan(0);
    });
});
