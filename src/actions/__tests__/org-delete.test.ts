/**
 * Tests for org deletion safety check (checkOrgDeletable / deleteOrganization).
 *
 * These are unit-level tests that exercise the blocker-list logic via
 * the shared getOrgBlockers helper.  Because getOrgBlockers is not exported
 * (internal helper), we test through the public checkOrgDeletable action.
 *
 * We mock prisma to avoid hitting a real DB.
 */

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("@/lib/prisma", () => {
    const counts: Record<string, number> = {};
    const mockPrisma = {
        organization: {
            findUnique: jest.fn().mockResolvedValue({ id: "org-1", name: "Test Org" }),
            delete: jest.fn().mockResolvedValue({ id: "org-1" }),
        },
        membership:                       { count: jest.fn(() => Promise.resolve(counts["membership"] ?? 0)) },
        clientLEOwner:                    { count: jest.fn(() => Promise.resolve(counts["clientLEOwner"] ?? 0)) },
        fIEngagement:                     { count: jest.fn(() => Promise.resolve(counts["fIEngagement"] ?? 0)) },
        questionnaire:                    { count: jest.fn(() => Promise.resolve(counts["questionnaire"] ?? 0)) },
        customFieldDefinition:            { count: jest.fn(() => Promise.resolve(counts["customFieldDefinition"] ?? 0)) },
        fISchema:                         { count: jest.fn(() => Promise.resolve(counts["fISchema"] ?? 0)) },
        invitation:                       { count: jest.fn(() => Promise.resolve(counts["invitation"] ?? 0)) },
        fieldClaim:                       { count: jest.fn(() => Promise.resolve(counts["fieldClaim"] ?? 0)) },
        questionnaireVisibilityGrant:     { count: jest.fn(() => Promise.resolve(counts["visibilityGrant"] ?? 0)) },
        _counts: counts, // exposed for test manipulation
    };
    return { __esModule: true, default: mockPrisma };
});

jest.mock("@/actions/admin", () => ({
    isSystemAdmin: jest.fn().mockResolvedValue(true),
}));

jest.mock("next/cache", () => ({
    revalidatePath: jest.fn(),
}));

import { checkOrgDeletable, deleteOrganization } from "../org";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getMockCounts(): Record<string, number> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("@/lib/prisma").default._counts;
}

function resetCounts() {
    const counts = getMockCounts();
    Object.keys(counts).forEach(k => delete counts[k]);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("checkOrgDeletable", () => {
    beforeEach(() => resetCounts());

    it("returns deletable: true when org has zero relations", async () => {
        const res = await checkOrgDeletable("org-1");
        expect(res.deletable).toBe(true);
        expect(res.blockers).toBeUndefined();
    });

    it("returns deletable: false with correct blocker when org has members", async () => {
        getMockCounts()["membership"] = 3;
        const res = await checkOrgDeletable("org-1");
        expect(res.deletable).toBe(false);
        expect(res.error).toContain("3 members");
    });

    it("returns deletable: false with multiple blockers", async () => {
        const counts = getMockCounts();
        counts["membership"] = 1;
        counts["fIEngagement"] = 2;
        const res = await checkOrgDeletable("org-1");
        expect(res.deletable).toBe(false);
        expect(res.error).toContain("1 member");
        expect(res.error).toContain("2 engagements");
    });

    it("returns correct singular/plural for 1 entity", async () => {
        getMockCounts()["clientLEOwner"] = 1;
        const res = await checkOrgDeletable("org-1");
        expect(res.error).toContain("1 owned legal entity");
    });

    it("returns correct plural for multiple entities", async () => {
        getMockCounts()["clientLEOwner"] = 5;
        const res = await checkOrgDeletable("org-1");
        expect(res.error).toContain("5 owned legal entities");
    });
});

describe("deleteOrganization", () => {
    beforeEach(() => resetCounts());

    it("deletes when no blockers exist", async () => {
        const res = await deleteOrganization("org-1");
        expect(res.success).toBe(true);
    });

    it("refuses deletion when blockers exist (race-condition guard)", async () => {
        getMockCounts()["membership"] = 1;
        const res = await deleteOrganization("org-1");
        expect(res.success).toBe(false);
        expect(res.error).toContain("1 member");
    });
});
