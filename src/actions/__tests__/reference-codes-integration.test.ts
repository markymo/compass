import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import prisma from '@/lib/prisma';
import { addToReferenceLibrary, createWorkingCopy, previewPublishReferenceSnapshot, archiveWorkingCopy, deleteWorkingCopy, archiveReferenceSnapshot, deleteReferenceSnapshot, getQuestionnairesV2 } from '../questionnaires-v2';
import { assignQuestionnaireToEngagement } from '../questionnaire';
import { bootstrapSystemOrg } from '../admin';

// Mock security and auth
vi.mock('@/actions/security', () => ({
    isSystemAdmin: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: 'test-user-id' }),
}));

// Mock permissions
vi.mock('@/lib/auth/permissions', () => ({
    ensureAuthorization: vi.fn().mockResolvedValue(true),
    can: vi.fn().mockReturnValue(true),
    Action: { ENG_EDIT_DRAFT_RESPONSES: 'ENG_EDIT_DRAFT_RESPONSES' },
}));

// Mock next/cache
vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
    unstable_noStore: vi.fn(),
}));

// We only want to test the db interactions conceptually, but since this runs against the test DB,
// we should just let it run or mock prisma. The project seems to run tests against a real DB (from test output).
// Let's create actual DB entries.

describe.skipIf(!process.env.DATABASE_URL)('Reference Codes Integration', () => {
    let sysOrgId: string;
    let templateId: string;
    let engagementId: string;
    let currentLeShort: string;
    let currentOrgShort: string;

    const testQuestionnaires: string[] = [];
    const testEngagements: string[] = [];
    const testOrgs: string[] = [];
    const testLEs: string[] = [];

    beforeEach(async () => {
        const sysOrg = await bootstrapSystemOrg();
        sysOrgId = sysOrg.id;

        const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
        currentLeShort = `L${suffix}`;
        currentOrgShort = `S${suffix}`;

        const le = await prisma.clientLE.create({
            data: { name: `Test LE ${suffix}`, shortCode: currentLeShort }
        });
        testLEs.push(le.id);

        const org = await prisma.organization.create({
            data: { name: `Test SUP ${suffix}`, shortCode: currentOrgShort }
        });
        testOrgs.push(org.id);

        const eng = await prisma.fIEngagement.create({
            data: {
                fiOrgId: org.id,
                clientLEId: le.id,
                status: 'PREPARATION',
            }
        });
        engagementId = eng.id;
        testEngagements.push(eng.id);

        await prisma.user.upsert({
            where: { id: 'test-user-id' },
            create: { id: 'test-user-id', email: 'test@example.com', name: 'Test User' },
            update: {}
        });

        await prisma.membership.create({
            data: {
                userId: 'test-user-id',
                fiEngagementId: eng.id,
                role: 'ADMIN',
            }
        });
    });

    afterEach(async () => {
        // Cleanup memberships first to avoid FK errors
        await prisma.membership.deleteMany({
            where: { fiEngagementId: { in: testEngagements } }
        });

        // Cleanup questionnaires
        const qv = await prisma.questionnaire.findMany({
            where: { OR: [ { fiEngagementId: { in: testEngagements } }, { name: { startsWith: 'Test Working Copy' } }, { name: 'Source Snapshot' } ] }
        });
        await prisma.question.deleteMany({ where: { questionnaireId: { in: qv.map((q: any) => q.id) } } });
        await prisma.questionnaire.deleteMany({ where: { id: { in: qv.map((q: any) => q.id) } } });

        // Cleanup engagements, orgs, les
        await prisma.fIEngagement.deleteMany({ where: { id: { in: testEngagements } } });
        await prisma.organization.deleteMany({ where: { id: { in: testOrgs } } });
        await prisma.clientLE.deleteMany({ where: { id: { in: testLEs } } });
    });

    it('addToReferenceLibrary stamps generated referenceCode on REFERENCE_SNAPSHOT', async () => {
        // Create a working copy
        const wc = await prisma.questionnaire.create({
            data: {
                name: 'Test Working Copy',
                functionalCode: 'FMSB',
                fiOrgId: sysOrgId,
                ownerOrgId: sysOrgId,
                status: 'DRAFT',
                kind: 'WORKING_COPY',
                isTemplate: true,
                isGlobal: false,
            }
        });

        const res = await addToReferenceLibrary(wc.id);
        expect(res.success).toBe(true);

        const ref = await prisma.questionnaire.findUnique({ where: { id: res.referenceId } });
        expect(ref?.kind).toBe('REFERENCE_SNAPSHOT');
        expect(ref?.functionalCode).toBe('FMSB');
        expect(ref?.referenceCode).toMatch(/^FMSB_\d{6}_ONPRO_XXXXX_SSSSS_v\d+$/);
        // Action returns the new snapshot's name and referenceCode directly
        expect(res.snapshotReferenceCode).toMatch(/^FMSB_\d{6}_ONPRO_XXXXX_SSSSS_v\d+$/);
        // For WCs without UNPUBLISHED token, snapshotName is kept as the source name
        expect(res.snapshotName).toBe('Test Working Copy');

        // Test version increment
        const wc2 = await prisma.questionnaire.create({
            data: {
                name: 'Test Working Copy 2',
                functionalCode: 'FMSB',
                fiOrgId: sysOrgId,
                ownerOrgId: sysOrgId,
                status: 'DRAFT',
                kind: 'WORKING_COPY',
                isTemplate: true,
                isGlobal: false,
            }
        });

        const res2 = await addToReferenceLibrary(wc2.id);
        expect(res2.success).toBe(true);
        const ref2 = await prisma.questionnaire.findUnique({ where: { id: res2.referenceId } });
        expect(ref2?.referenceCode).toMatch(/^FMSB_\d{6}_ONPRO_XXXXX_SSSSS_v\d+$/);
        expect(res2.snapshotReferenceCode).toMatch(/^FMSB_\d{6}_ONPRO_XXXXX_SSSSS_v\d+$/);
        
        templateId = ref2!.id;
    });

    it('addToReferenceLibrary replaces UNPUBLISHED with publish date and versions name/code', async () => {
        const wc = await prisma.questionnaire.create({
            data: {
                name: 'FMSBUK_UNPUBLISHED_ONPRO_XXXXX_SSSSS',
                functionalCode: 'FMSBUK',
                fiOrgId: sysOrgId,
                ownerOrgId: sysOrgId,
                status: 'DRAFT',
                kind: 'WORKING_COPY',
                isTemplate: true,
                isGlobal: false,
            }
        });

        const res = await addToReferenceLibrary(wc.id);
        expect(res.success).toBe(true);

        const ref = await prisma.questionnaire.findUnique({ where: { id: res.referenceId } });
        expect(ref?.kind).toBe('REFERENCE_SNAPSHOT');
        expect(ref?.functionalCode).toBe('FMSBUK');
        expect(ref?.referenceCode).not.toContain('UNPUBLISHED');
        expect(ref?.referenceCode).toMatch(/^FMSBUK_\d{6}_ONPRO_XXXXX_SSSSS_v\d+$/);
        expect(ref?.name).not.toContain('UNPUBLISHED');
        expect(ref?.name).toMatch(/^FMSBUK_\d{6}_ONPRO_XXXXX_SSSSS_v\d+$/);
        // Action return values are also clean
        expect(res.snapshotReferenceCode).not.toContain('UNPUBLISHED');
        expect(res.snapshotReferenceCode).toMatch(/^FMSBUK_\d{6}_ONPRO_XXXXX_SSSSS_v\d+$/);
        expect(res.snapshotName).not.toContain('UNPUBLISHED');

        // Assert source working copy name is untouched
        const originalWc = await prisma.questionnaire.findUnique({ where: { id: wc.id } });
        expect(originalWc?.name).toBe('FMSBUK_UNPUBLISHED_ONPRO_XXXXX_SSSSS');

        // cleanup
        await prisma.questionnaire.delete({ where: { id: ref!.id } });
        await prisma.questionnaire.delete({ where: { id: wc.id } });
    });

    it('previewPublishReferenceSnapshot returns correct preview without writing to DB', async () => {
        const wc = await prisma.questionnaire.create({
            data: {
                name: 'FMSBUK_UNPUBLISHED_ONPRO_XXXXX_SSSSS',
                functionalCode: 'FMSBUK',
                fiOrgId: sysOrgId,
                ownerOrgId: sysOrgId,
                status: 'DRAFT',
                kind: 'WORKING_COPY',
                isTemplate: true,
                isGlobal: false,
            }
        });

        const res = await previewPublishReferenceSnapshot(wc.id);
        expect(res.success).toBe(true);
        expect(res.preview).toBeDefined();
        expect(res.preview!.sourceName).toBe('FMSBUK_UNPUBLISHED_ONPRO_XXXXX_SSSSS');
        expect(res.preview!.proposedReferenceCode).not.toContain('UNPUBLISHED');
        expect(res.preview!.proposedReferenceCode).toMatch(/^FMSBUK_\d{6}_ONPRO_XXXXX_SSSSS_v\d+$/);
        expect(res.preview!.proposedSnapshotName).not.toContain('UNPUBLISHED');
        expect(res.preview!.proposedSnapshotName).toMatch(/^FMSBUK_\d{6}_ONPRO_XXXXX_SSSSS_v\d+$/);
        expect(res.preview!.nextVersion).toBeGreaterThanOrEqual(1);
        expect(res.preview!.publishDateToken).toMatch(/^\d{6}$/);

        // No snapshot should have been written
        const snapshots = await prisma.questionnaire.findMany({ where: { kind: 'REFERENCE_SNAPSHOT', sourceId: wc.id } });
        expect(snapshots).toHaveLength(0);

        // cleanup
        await prisma.questionnaire.delete({ where: { id: wc.id } });
    });

    it('createWorkingCopy copies referenceCode for provenance', async () => {
        const ref = await prisma.questionnaire.create({
            data: {
                name: 'Source Snapshot',
                functionalCode: 'FMSB',
                fiOrgId: sysOrgId,
                ownerOrgId: sysOrgId,
                status: 'ACTIVE',
                kind: 'REFERENCE_SNAPSHOT',
                isTemplate: true,
                isGlobal: true,
                referenceCode: 'FMSB_260605_ONPRO_XXXXX_SSSSS_v2'
            }
        });
        
        const res = await createWorkingCopy(ref.id);
        expect(res.success).toBe(true);

        const wc = await prisma.questionnaire.findUnique({ where: { id: res.workingCopyId } });
        expect(wc?.kind).toBe('WORKING_COPY');
        expect(wc?.functionalCode).toBe('FMSB');
        // It carries the source reference code
        expect(wc?.referenceCode).toMatch(/^FMSB_\d{6}_ONPRO_XXXXX_SSSSS_v\d+$/);
    });

    it('assignQuestionnaireToEngagement copies referenceCode and generates title', async () => {
        const ref = await prisma.questionnaire.create({
            data: {
                name: 'Source Snapshot',
                functionalCode: 'FMSB',
                fiOrgId: sysOrgId,
                ownerOrgId: sysOrgId,
                status: 'ACTIVE',
                kind: 'REFERENCE_SNAPSHOT',
                isTemplate: true,
                isGlobal: true,
                referenceCode: 'FMSB_260605_ONPRO_XXXXX_SSSSS_v2',
                visibility: 'GLOBAL', // must be discoverable by the per-test engagement org
            }
        });


        const res = await assignQuestionnaireToEngagement(ref.id, engagementId);
        if (!res.success) {
            console.error("Test assignQuestionnaireToEngagement error:", res.error);
        }
        expect(res.success).toBe(true);

        const instance = await prisma.questionnaire.findUnique({ where: { id: res.id } });
        expect(instance?.kind).toBe('ENGAGEMENT_QUESTIONNAIRE');
        expect(instance?.functionalCode).toBe('FMSB');
        expect(instance?.referenceCode).toMatch(/^FMSB_\d{6}_ONPRO_XXXXX_SSSSS_v\d+$/);
        
        // The default title is derived from the referenceCode: strip _v{n}, substitute real LE/supplier codes.
        // referenceCode = 'FMSB_260605_ONPRO_XXXXX_SSSSS_v2'
        // → strip _v2 → 'FMSB_260605_ONPRO_XXXXX_SSSSS'
        // → sub XXXXX=leShort, SSSSS=orgShort
        expect(instance?.name).toBe(`FMSB_260605_ONPRO_${currentLeShort}_${currentOrgShort}`);
    });

    it('New Working Copy creation rejects empty functionalCode and enforces formatting', async () => {
        const { createManualQuestionnaire } = await import('../questionnaire');
        
        const res1 = await createManualQuestionnaire({
            name: 'Ignored Name',
            questions: 'Question 1',
            functionalCode: '   ', // empty
        });
        expect(res1.success).toBe(false);
        expect(res1.error).toContain('cannot be empty');

        const res2 = await createManualQuestionnaire({
            name: 'Ignored Name',
            questions: 'Question 1',
            functionalCode: 'FMSB UK',
        });
        expect(res2.success).toBe(true);
        expect(res2.id).toBeDefined();

        const wc = await prisma.questionnaire.findUnique({ where: { id: res2.id } });
        expect(wc?.name).toBe('FMSBUK_UNPUBLISHED_ONPRO_XXXXX_SSSSS');
        expect(wc?.functionalCode).toBe('FMSBUK');
        expect(wc?.kind).toBe('WORKING_COPY');
        expect(wc?.ownerOrgId).toBe(sysOrgId);
        expect(wc?.isTemplate).toBe(true);
        expect(wc?.isGlobal).toBe(false);
        expect(wc?.referenceCode).toBeNull();
        
        // cleanup
        await prisma.question.deleteMany({ where: { questionnaireId: wc!.id } });
        await prisma.questionnaire.delete({ where: { id: wc!.id } });
    });

    it('archiveWorkingCopy sets status=ARCHIVED and preserves snapshot lineage', async () => {
        // Create a working copy and publish a snapshot from it
        const wc = await prisma.questionnaire.create({
            data: {
                name: 'FMSBUK_UNPUBLISHED_ONPRO_XXXXX_SSSSS',
                functionalCode: 'FMSBUK',
                fiOrgId: sysOrgId,
                ownerOrgId: sysOrgId,
                status: 'DRAFT',
                kind: 'WORKING_COPY',
                isTemplate: true,
                isGlobal: false,
            }
        });

        const pubRes = await addToReferenceLibrary(wc.id);
        expect(pubRes.success).toBe(true);
        const snapshotId = pubRes.referenceId!;

        // Archive the working copy
        const archRes = await archiveWorkingCopy(wc.id);
        expect(archRes.success).toBe(true);

        // Archive = status ARCHIVED, NOT hard/soft-deleted
        const archivedWc = await prisma.questionnaire.findUnique({ where: { id: wc.id } });
        expect(archivedWc?.status).toBe('ARCHIVED');
        expect(archivedWc?.isDeleted).toBe(false);

        // WC must NOT appear in the live list (excluded by status filter)
        const { workingCopies } = await getQuestionnairesV2();
        expect(workingCopies.find(r => r.id === wc.id)).toBeUndefined();

        // Reference Snapshot must still exist with its sourceId intact
        const snapshot = await prisma.questionnaire.findUnique({ where: { id: snapshotId } });
        expect(snapshot?.isDeleted).toBe(false);
        expect(snapshot?.sourceId).toBe(wc.id);

        // Archiving a non-WORKING_COPY must fail gracefully
        const badRes = await archiveWorkingCopy(snapshotId);
        expect(badRes.success).toBe(false);
        expect(badRes.error).toMatch(/Only Working Copies/);

        // cleanup
        await prisma.questionnaire.delete({ where: { id: snapshotId } });
        await prisma.questionnaire.delete({ where: { id: wc.id } });
    });

    // ── V2 Library Lifecycle: Archive & Delete ──────────────────────────────

    async function makeWC(sysOrgId: string, suffix = '') {
        return prisma.questionnaire.create({
            data: {
                name: `FMSBUK_UNPUBLISHED_ONPRO_XXXXX_SSSSS${suffix}`,
                functionalCode: 'FMSBUK',
                fiOrgId: sysOrgId,
                ownerOrgId: sysOrgId,
                status: 'DRAFT',
                kind: 'WORKING_COPY',
                isTemplate: true,
                isGlobal: false,
            }
        });
    }

    it('delete unused Reference Snapshot is allowed', async () => {
        const wc = await makeWC(sysOrgId, '_del_unused');
        const pub = await addToReferenceLibrary(wc.id);
        expect(pub.success).toBe(true);
        const snapId = pub.referenceId!;

        const res = await deleteReferenceSnapshot(snapId);
        expect(res.success).toBe(true);

        const deleted = await prisma.questionnaire.findUnique({ where: { id: snapId } });
        expect(deleted?.isDeleted).toBe(true);

        // cleanup
        await prisma.questionnaire.delete({ where: { id: snapId } });
        await prisma.questionnaire.delete({ where: { id: wc.id } });
    });

    it('delete used Reference Snapshot is rejected with REFERENCE_SNAPSHOT_HAS_DESCENDANTS', async () => {
        const wc = await makeWC(sysOrgId, '_del_used');
        const pub = await addToReferenceLibrary(wc.id);
        const snapId = pub.referenceId!;

        // create a working copy from the snapshot (descendant)
        const wcFromSnap = await createWorkingCopy(snapId);
        expect(wcFromSnap.success).toBe(true);
        const childId = wcFromSnap.workingCopyId!;

        const res = await deleteReferenceSnapshot(snapId);
        expect(res.success).toBe(false);
        expect(res.code).toBe('REFERENCE_SNAPSHOT_HAS_DESCENDANTS');

        // cleanup
        await prisma.questionnaire.delete({ where: { id: childId } });
        await prisma.questionnaire.delete({ where: { id: snapId } });
        await prisma.questionnaire.delete({ where: { id: wc.id } });
    });

    it('archive used Reference Snapshot is allowed even with descendants', async () => {
        const wc = await makeWC(sysOrgId, '_arch_used');
        const pub = await addToReferenceLibrary(wc.id);
        const snapId = pub.referenceId!;

        // create a descendant
        const wcFromSnap = await createWorkingCopy(snapId);
        const childId = wcFromSnap.workingCopyId!;

        const res = await archiveReferenceSnapshot(snapId);
        expect(res.success).toBe(true);

        const archived = await prisma.questionnaire.findUnique({ where: { id: snapId } });
        expect(archived?.status).toBe('ARCHIVED');
        expect(archived?.isDeleted).toBe(false);

        // cleanup
        await prisma.questionnaire.delete({ where: { id: childId } });
        await prisma.questionnaire.delete({ where: { id: snapId } });
        await prisma.questionnaire.delete({ where: { id: wc.id } });
    });

    it('deleteWorkingCopy soft-deletes the WC regardless of descendants', async () => {
        const wc = await makeWC(sysOrgId, '_del_wc');
        const res = await deleteWorkingCopy(wc.id);
        expect(res.success).toBe(true);

        const deleted = await prisma.questionnaire.findUnique({ where: { id: wc.id } });
        expect(deleted?.isDeleted).toBe(true);

        // cleanup
        await prisma.questionnaire.delete({ where: { id: wc.id } });
    });

    it('getQuestionnairesV2 excludes archived and deleted rows from the live list', async () => {
        const wc = await makeWC(sysOrgId, '_excluded');
        const pub = await addToReferenceLibrary(wc.id);
        const snapId = pub.referenceId!;

        // Archive the snapshot, delete the WC
        await archiveReferenceSnapshot(snapId);
        await deleteWorkingCopy(wc.id);

        const { workingCopies, referenceLibrary } = await getQuestionnairesV2();

        expect(workingCopies.find(r => r.id === wc.id)).toBeUndefined();
        expect(referenceLibrary.find(r => r.id === snapId)).toBeUndefined();

        // cleanup
        await prisma.questionnaire.delete({ where: { id: snapId } });
        await prisma.questionnaire.delete({ where: { id: wc.id } });
    });
});
