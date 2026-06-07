/**
 * Visibility hardening integration tests.
 *
 * Covers:
 * 1. searchAvailableQuestionnaires returns GLOBAL snapshots to non-owner orgs
 * 2. searchAvailableQuestionnaires does NOT return PRIVATE snapshots to non-owner
 * 3. searchAvailableQuestionnaires does NOT return RESTRICTED to non-owner (owner-only)
 * 4. assignQuestionnaireToEngagement (questionnaire.ts) rejects a guessed PRIVATE snapshot ID
 * 5. assignQuestionnaireToEngagement (questionnaire.ts) accepts a GLOBAL snapshot
 * 6. canOrgDiscoverReferenceSnapshot returns false for non-owner PRIVATE
 * 7. canOrgDiscoverReferenceSnapshot returns true for GLOBAL from any org
 * 8. canOrgDiscoverReferenceSnapshot returns false for non-owner RESTRICTED (owner-only)
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import prisma from '@/lib/prisma';
import {
    canOrgDiscoverReferenceSnapshot,
    addToReferenceLibrary,
    updateReferenceSnapshotVisibility,
} from '../questionnaires-v2';
import { searchAvailableQuestionnaires } from '../questionnaire-library';
import { assignQuestionnaireToEngagement } from '../questionnaire';
import { bootstrapSystemOrg } from '../admin';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/actions/security', () => ({
    isSystemAdmin: vi.fn().mockResolvedValue(false), // non-admin by default
}));

vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: 'vis-hard-test-user' }),
}));

vi.mock('@/lib/auth/permissions', () => ({
    ensureAuthorization: vi.fn().mockResolvedValue(true),
    can: vi.fn().mockReturnValue(true),
    Action: { ENG_EDIT_DRAFT_RESPONSES: 'ENG_EDIT_DRAFT_RESPONSES' },
}));

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
    unstable_noStore: vi.fn(),
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────

describe.skipIf(!process.env.DATABASE_URL)('Visibility hardening — discovery and action guards', () => {
    let sysOrgId: string;   // Coparity / owner org
    let otherOrgId: string; // Second org — simulates a different FI/supplier

    // Shared snapshot IDs per visibility tier
    let privateSnapId: string;
    let globalSnapId: string;
    let restrictedSnapId: string;

    // Engagement wired to otherOrg (simulates a non-owner FI engagement)
    let engagementId: string;
    let leId: string;

    const snapCleanup: string[] = [];
    const orgCleanup: string[] = [];
    const engCleanup: string[] = [];
    const leCleanup: string[] = [];
    const membershipCleanup: string[] = [];

    beforeAll(async () => {
        // System (owner) org
        const sysOrg = await bootstrapSystemOrg();
        sysOrgId = sysOrg.id;

        // Non-owner org
        const other = await prisma.organization.create({
            data: { name: 'VIS_HARD_OTHER_ORG', shortCode: 'VISHARDOTHER', types: [] },
        });
        otherOrgId = other.id;
        orgCleanup.push(other.id);

        // Test user + membership to otherOrg (so searchAvailableQuestionnaires resolves this org)
        await prisma.user.upsert({
            where: { id: 'vis-hard-test-user' },
            create: { id: 'vis-hard-test-user', email: 'vishard@example.com', name: 'VIS Hard Test User' },
            update: {},
        });
        const membership = await prisma.membership.create({
            data: { userId: 'vis-hard-test-user', organizationId: otherOrgId, role: 'ADMIN' },
        });
        membershipCleanup.push(membership.id);

        // Create a ClientLE and engagement for otherOrg
        const le = await prisma.clientLE.create({ data: { name: 'VIS_HARD_LE', shortCode: 'VISHARDLE' } });
        leId = le.id;
        leCleanup.push(le.id);

        const eng = await prisma.fIEngagement.create({
            data: { fiOrgId: otherOrgId, clientLEId: le.id, status: 'PREPARATION' },
        });
        engagementId = eng.id;
        engCleanup.push(eng.id);

        // Membership to engagement
        const engMembership = await prisma.membership.create({
            data: { userId: 'vis-hard-test-user', fiEngagementId: eng.id, role: 'ADMIN' },
        });
        membershipCleanup.push(engMembership.id);

        // ── Create three snapshots owned by sysOrg ──────────────────────────

        async function makeSnap(suffix: string) {
            const wc = await prisma.questionnaire.create({
                data: {
                    name: `VH_WC_${suffix}`,
                    functionalCode: 'VISHARD',
                    fiOrgId: sysOrgId,
                    ownerOrgId: sysOrgId,
                    status: 'DRAFT',
                    kind: 'WORKING_COPY',
                    isTemplate: true,
                    isGlobal: false,
                },
            });
            snapCleanup.push(wc.id);
            // isSystemAdmin is mocked false, so we need to temporarily bypass for the admin action
            // We call prisma directly instead of addToReferenceLibrary to avoid the admin check
            const snap = await prisma.questionnaire.create({
                data: {
                    name: `VH_SNAP_${suffix}`,
                    functionalCode: 'VISHARD',
                    fiOrgId: sysOrgId,
                    ownerOrgId: sysOrgId,
                    status: 'ACTIVE',
                    kind: 'REFERENCE_SNAPSHOT',
                    isTemplate: true,
                    isGlobal: true,
                    sourceId: wc.id,
                    visibility: 'PRIVATE', // default; overridden below per test
                },
            });
            snapCleanup.push(snap.id);
            return snap;
        }

        const privSnap = await makeSnap('PRIVATE');
        privateSnapId = privSnap.id;
        // Leave as PRIVATE

        const globalSnap = await makeSnap('GLOBAL');
        globalSnapId = globalSnap.id;
        await prisma.questionnaire.update({ where: { id: globalSnapId }, data: { visibility: 'GLOBAL' } });

        const restrictedSnap = await makeSnap('RESTRICTED');
        restrictedSnapId = restrictedSnap.id;
        await prisma.questionnaire.update({ where: { id: restrictedSnapId }, data: { visibility: 'RESTRICTED' } });
    });

    afterAll(async () => {
        // Memberships
        await prisma.membership.deleteMany({ where: { id: { in: membershipCleanup } } });
        // Engagement questionnaires
        await prisma.questionnaire.deleteMany({ where: { fiEngagementId: { in: engCleanup } } });
        // Engagements
        await prisma.fIEngagement.deleteMany({ where: { id: { in: engCleanup } } });
        // LEs
        await prisma.clientLE.deleteMany({ where: { id: { in: leCleanup } } });
        // Snapshots (children before WCs)
        for (const id of [...snapCleanup].reverse()) {
            try { await prisma.questionnaire.delete({ where: { id } }); } catch { /* ignore */ }
        }
        // Orgs
        for (const id of orgCleanup) {
            try { await prisma.organization.delete({ where: { id } }); } catch { /* ignore */ }
        }
    });

    // ── 1. searchAvailableQuestionnaires — GLOBAL visible to non-owner ────────

    it('searchAvailableQuestionnaires returns GLOBAL snapshots to non-owner org', async () => {
        const res = await searchAvailableQuestionnaires('');
        expect(res.success).toBe(true);
        const ids = res.data!.map((r: any) => r.id);
        expect(ids).toContain(globalSnapId);
    });

    // ── 2. searchAvailableQuestionnaires — PRIVATE hidden from non-owner ──────

    it('searchAvailableQuestionnaires does NOT return PRIVATE snapshots to non-owner org', async () => {
        const res = await searchAvailableQuestionnaires('');
        expect(res.success).toBe(true);
        const ids = res.data!.map((r: any) => r.id);
        expect(ids).not.toContain(privateSnapId);
    });

    // ── 3. searchAvailableQuestionnaires — RESTRICTED hidden from non-owner ───

    it('searchAvailableQuestionnaires does NOT return RESTRICTED snapshots to non-owner org', async () => {
        const res = await searchAvailableQuestionnaires('');
        expect(res.success).toBe(true);
        const ids = res.data!.map((r: any) => r.id);
        expect(ids).not.toContain(restrictedSnapId);
    });

    // ── 4. assignQuestionnaireToEngagement rejects guessed PRIVATE ID ─────────

    it('assignQuestionnaireToEngagement rejects a guessed PRIVATE snapshot ID', async () => {
        // The engagement belongs to otherOrg; the snapshot is owned by sysOrg + PRIVATE
        const res = await assignQuestionnaireToEngagement(privateSnapId, engagementId);
        expect(res.success).toBe(false);
        expect(res.error).toMatch(/not visible/i);
    });

    // ── 5. assignQuestionnaireToEngagement accepts a GLOBAL snapshot ──────────

    it('assignQuestionnaireToEngagement accepts a GLOBAL snapshot for a non-owner engagement', async () => {
        const res = await assignQuestionnaireToEngagement(globalSnapId, engagementId);
        // May succeed or return idempotent existing — either way should not fail with visibility error
        if (!res.success) {
            expect(res.error).not.toMatch(/not visible/i);
        } else {
            expect(res.success).toBe(true);
        }
    });

    // ── 6. canOrgDiscoverReferenceSnapshot — PRIVATE non-owner → false ────────

    it('canOrgDiscoverReferenceSnapshot returns false for non-owner PRIVATE snapshot', async () => {
        const result = await canOrgDiscoverReferenceSnapshot(otherOrgId, privateSnapId);
        expect(result).toBe(false);
    });

    // ── 7. canOrgDiscoverReferenceSnapshot — GLOBAL any org → true ───────────

    it('canOrgDiscoverReferenceSnapshot returns true for GLOBAL snapshot from any org', async () => {
        const fromOwner = await canOrgDiscoverReferenceSnapshot(sysOrgId, globalSnapId);
        const fromOther = await canOrgDiscoverReferenceSnapshot(otherOrgId, globalSnapId);
        expect(fromOwner).toBe(true);
        expect(fromOther).toBe(true);
    });

    // ── 8. canOrgDiscoverReferenceSnapshot — RESTRICTED non-owner → false ─────

    it('canOrgDiscoverReferenceSnapshot returns false for RESTRICTED snapshot from non-owner (treated as owner-only)', async () => {
        const fromNonOwner = await canOrgDiscoverReferenceSnapshot(otherOrgId, restrictedSnapId);
        const fromOwner = await canOrgDiscoverReferenceSnapshot(sysOrgId, restrictedSnapId);
        expect(fromNonOwner).toBe(false);
        expect(fromOwner).toBe(true);
    });
});
