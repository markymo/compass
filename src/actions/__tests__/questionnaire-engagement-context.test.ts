/**
 * Engagement-context org resolution tests.
 *
 * Proves that searchAvailableQuestionnaires(query, engagementId) uses
 * FIEngagement.fiOrgId as the discovery context, not the user's oldest membership.
 *
 * Scenario:
 *   - User "multi-org-user" is a member of Org A (oldest) AND Org B.
 *   - Org A owns a PRIVATE snapshot (should NOT be visible in an Org B engagement).
 *   - Org B owns a PRIVATE snapshot (SHOULD be visible when engagementId→Org B).
 *   - A GLOBAL snapshot owned by sysOrg is visible to all.
 *   - Engagement is wired to Org B (fiOrgId = Org B).
 *
 * Covers:
 * 1. With engagementId: Org B PRIVATE snapshot appears.
 * 2. With engagementId: Org A PRIVATE snapshot does NOT appear.
 * 3. With engagementId: GLOBAL snapshot appears.
 * 4. Without engagementId (fallback): resolves from oldest membership (Org A)
 *    → Org A PRIVATE appears, Org B PRIVATE does NOT.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import prisma from '@/lib/prisma';
import { searchAvailableQuestionnaires } from '../questionnaire-library';
import { bootstrapSystemOrg } from '../admin';

// ── Mocks ────────────────────────────────────────────────────────────────────

let testUserId = 'multi-org-test-user';

vi.mock('@/actions/security', () => ({
    isSystemAdmin: vi.fn().mockResolvedValue(false),
}));

vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockImplementation(async () => ({ userId: testUserId })),
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

describe.skipIf(!process.env.DATABASE_URL)('searchAvailableQuestionnaires — engagement-context org resolution', () => {
    let sysOrgId: string;
    let orgAId: string;     // User's OLDEST membership — should be the fallback org
    let orgBId: string;     // Engagement fiOrgId — should be authoritative when engagementId provided
    let engagementId: string;

    let globalSnapId: string;       // Owned by sysOrg, GLOBAL — always visible
    let orgAPrivateSnapId: string;  // Owned by Org A, PRIVATE — only visible to Org A
    let orgBPrivateSnapId: string;  // Owned by Org B, PRIVATE — only visible to Org B

    const snapCleanup: string[] = [];
    const orgCleanup: string[] = [];
    const engCleanup: string[] = [];
    const leCleanup: string[] = [];
    const membershipCleanup: string[] = [];

    beforeAll(async () => {
        const sysOrg = await bootstrapSystemOrg();
        sysOrgId = sysOrg.id;

        const rand = Math.floor(Math.random() * 100000);
        testUserId = `multi-org-user-${Date.now()}-${rand}`;

        // Create Org A and Org B
        const orgA = await prisma.organization.create({
            data: { name: `ENG_CTX_ORG_A_${rand}`, shortCode: `ECA${rand}`, types: ['FI'] },
        });
        orgAId = orgA.id;
        orgCleanup.push(orgA.id);

        const orgB = await prisma.organization.create({
            data: { name: `ENG_CTX_ORG_B_${rand}`, shortCode: `ECB${rand}`, types: ['FI'] },
        });
        orgBId = orgB.id;
        orgCleanup.push(orgB.id);

        // User exists + two memberships: Org A first (oldest), then Org B
        await prisma.user.create({
            data: { id: testUserId, email: `${testUserId}@example.com`, name: 'Multi Org User' },
        });

        // Org A membership — created first so it is the "oldest" for fallback
        const mbrA = await prisma.membership.create({
            data: { userId: testUserId, organizationId: orgAId, role: 'ADMIN' },
        });
        membershipCleanup.push(mbrA.id);

        // Small delay to ensure Org B membership has a later createdAt
        await new Promise(r => setTimeout(r, 20));

        const mbrB = await prisma.membership.create({
            data: { userId: testUserId, organizationId: orgBId, role: 'ADMIN' },
        });
        membershipCleanup.push(mbrB.id);

        // Create a ClientLE and an engagement with fiOrgId = Org B
        const le = await prisma.clientLE.create({ data: { name: `ENG_CTX_LE_${rand}`, shortCode: `ECL${rand}` } });
        leCleanup.push(le.id);

        const eng = await prisma.fIEngagement.create({
            data: { fiOrgId: orgBId, clientLEId: le.id, status: 'PREPARATION' },
        });
        engagementId = eng.id;
        engCleanup.push(eng.id);

        // Engagement membership for the user
        const mbrEng = await prisma.membership.create({
            data: { userId: testUserId, fiEngagementId: eng.id, role: 'ADMIN' },
        });
        membershipCleanup.push(mbrEng.id);

        // Helper: create a REFERENCE_SNAPSHOT owned by a given org
        async function makeSnap(ownerOrgId: string, label: string, visibility: string) {
            const fiOrgId = ownerOrgId; // fiOrg is used as the hosting org
            const snap = await prisma.questionnaire.create({
                data: {
                    name: `ENG_CTX_SNAP_${label}`,
                    functionalCode: 'ENGCTX',
                    fiOrgId,
                    ownerOrgId,
                    status: 'ACTIVE',
                    kind: 'REFERENCE_SNAPSHOT',
                    isTemplate: true,
                    isGlobal: visibility === 'GLOBAL',
                    visibility: visibility as any,
                },
            });
            snapCleanup.push(snap.id);
            return snap;
        }

        const globalSnap = await makeSnap(sysOrgId, 'GLOBAL', 'GLOBAL');
        globalSnapId = globalSnap.id;

        const orgASnap = await makeSnap(orgAId, 'ORGA_PRIVATE', 'PRIVATE');
        orgAPrivateSnapId = orgASnap.id;

        const orgBSnap = await makeSnap(orgBId, 'ORGB_PRIVATE', 'PRIVATE');
        orgBPrivateSnapId = orgBSnap.id;
    });

    afterAll(async () => {
        await prisma.membership.deleteMany({ where: { id: { in: membershipCleanup } } });
        await prisma.questionnaire.deleteMany({ where: { fiEngagementId: { in: engCleanup } } });
        await prisma.fIEngagement.deleteMany({ where: { id: { in: engCleanup } } });
        await prisma.clientLE.deleteMany({ where: { id: { in: leCleanup } } });
        for (const id of [...snapCleanup].reverse()) {
            try { await prisma.questionnaire.delete({ where: { id } }); } catch { /* ignore */ }
        }
        for (const id of orgCleanup) {
            try { await prisma.organization.delete({ where: { id } }); } catch { /* ignore */ }
        }
        if (testUserId) {
            try { await prisma.user.delete({ where: { id: testUserId } }); } catch { /* ignore */ }
        }
    });

    // ── 1. Engagement context: Org B PRIVATE snapshot is visible ─────────────

    it('with engagementId (Org B): shows Org B PRIVATE snapshot', async () => {
        const res = await searchAvailableQuestionnaires('', engagementId);
        expect(res.success).toBe(true);
        const ids = res.data!.map((r: any) => r.id);
        expect(ids).toContain(orgBPrivateSnapId);
    });

    // ── 2. Engagement context: Org A PRIVATE snapshot is NOT visible ──────────

    it('with engagementId (Org B): does NOT show Org A PRIVATE snapshot', async () => {
        const res = await searchAvailableQuestionnaires('', engagementId);
        expect(res.success).toBe(true);
        const ids = res.data!.map((r: any) => r.id);
        expect(ids).not.toContain(orgAPrivateSnapId);
    });

    // ── 3. Engagement context: GLOBAL snapshot is always visible ─────────────

    it('with engagementId (Org B): shows GLOBAL snapshot', async () => {
        const res = await searchAvailableQuestionnaires('', engagementId);
        expect(res.success).toBe(true);
        const ids = res.data!.map((r: any) => r.id);
        expect(ids).toContain(globalSnapId);
    });

    // ── 4. No engagementId (fallback): resolves to oldest membership = Org A ──
    //    Org A PRIVATE appears; Org B PRIVATE does NOT.

    it('without engagementId (fallback to oldest membership = Org A): shows Org A PRIVATE, not Org B PRIVATE', async () => {
        const res = await searchAvailableQuestionnaires('');
        expect(res.success).toBe(true);
        const ids = res.data!.map((r: any) => r.id);
        // Org A's PRIVATE IS visible (oldest membership = Org A)
        expect(ids).toContain(orgAPrivateSnapId);
        // Org B's PRIVATE is NOT visible via fallback (Org A context)
        expect(ids).not.toContain(orgBPrivateSnapId);
        // GLOBAL always visible
        expect(ids).toContain(globalSnapId);
    });

    // ── 5. fiOrg shape: no null crash ─────────────────────────────────────────

    it('all returned items have a non-null fiOrg with a name string', async () => {
        const res = await searchAvailableQuestionnaires('', engagementId);
        expect(res.success).toBe(true);
        for (const item of res.data!) {
            expect(item.fiOrg).not.toBeNull();
            expect(typeof item.fiOrg.name).toBe('string');
            expect(item.fiOrg.name.length).toBeGreaterThan(0);
        }
    });
});
