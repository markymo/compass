/**
 * Tests for org deletion safety check (checkOrgDeletable / deleteOrganization).
 *
 * Unit-level tests exercising the blocker-list logic through the public
 * checkOrgDeletable / deleteOrganization actions.
 *
 * All external dependencies (prisma, auth, next/cache) are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

// Cut the next-auth chain: org.ts → admin.ts → security.ts → auth.ts → next-auth
vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: 'user-123' }),
}));

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}));

vi.mock('@/actions/admin', () => ({
    isSystemAdmin: vi.fn().mockResolvedValue(true),
}));

// Shared counts object — tests mutate this directly to simulate DB state.
const counts: Record<string, number> = {};

vi.mock('@/lib/prisma', () => ({
    default: {
        organization: {
            findUnique: vi.fn().mockResolvedValue({ id: 'org-1', name: 'Test Org' }),
            delete: vi.fn().mockResolvedValue({ id: 'org-1' }),
        },
        membership:                   { count: vi.fn(() => Promise.resolve(counts['membership'] ?? 0)) },
        clientLEOwner:                { count: vi.fn(() => Promise.resolve(counts['clientLEOwner'] ?? 0)) },
        fIEngagement:                 { count: vi.fn(() => Promise.resolve(counts['fIEngagement'] ?? 0)) },
        questionnaire:                { count: vi.fn(() => Promise.resolve(counts['questionnaire'] ?? 0)) },
        customFieldDefinition:        { count: vi.fn(() => Promise.resolve(counts['customFieldDefinition'] ?? 0)) },
        fISchema:                     { count: vi.fn(() => Promise.resolve(counts['fISchema'] ?? 0)) },
        invitation:                   { count: vi.fn(() => Promise.resolve(counts['invitation'] ?? 0)) },
        fieldClaim:                   { count: vi.fn(() => Promise.resolve(counts['fieldClaim'] ?? 0)) },
        questionnaireVisibilityGrant: { count: vi.fn(() => Promise.resolve(counts['visibilityGrant'] ?? 0)) },
    },
}));

// Import after all mocks are registered
import { checkOrgDeletable, deleteOrganization } from '../org';

// ── Helpers ──────────────────────────────────────────────────────────────────

function resetCounts() {
    Object.keys(counts).forEach(k => delete counts[k]);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('checkOrgDeletable', () => {
    beforeEach(() => resetCounts());

    it('returns deletable: true when org has zero relations', async () => {
        const res = await checkOrgDeletable('org-1');
        expect(res.deletable).toBe(true);
        expect(res.blockers).toBeUndefined();
    });

    it('returns deletable: false with correct blocker when org has members', async () => {
        counts['membership'] = 3;
        const res = await checkOrgDeletable('org-1');
        expect(res.deletable).toBe(false);
        expect(res.error).toContain('3 members');
    });

    it('returns deletable: false with multiple blockers', async () => {
        counts['membership'] = 1;
        counts['fIEngagement'] = 2;
        const res = await checkOrgDeletable('org-1');
        expect(res.deletable).toBe(false);
        expect(res.error).toContain('1 member');
        expect(res.error).toContain('2 engagements');
    });

    it('returns correct singular/plural for 1 entity', async () => {
        counts['clientLEOwner'] = 1;
        const res = await checkOrgDeletable('org-1');
        expect(res.error).toContain('1 owned legal entity');
    });

    it('returns correct plural for multiple entities', async () => {
        counts['clientLEOwner'] = 5;
        const res = await checkOrgDeletable('org-1');
        expect(res.error).toContain('5 owned legal entities');
    });
});

describe('deleteOrganization', () => {
    beforeEach(() => resetCounts());

    it('deletes when no blockers exist', async () => {
        const res = await deleteOrganization('org-1');
        expect(res.success).toBe(true);
    });

    it('refuses deletion when blockers exist (race-condition guard)', async () => {
        counts['membership'] = 1;
        const res = await deleteOrganization('org-1');
        expect(res.success).toBe(false);
        expect(res.error).toContain('1 member');
    });
});
