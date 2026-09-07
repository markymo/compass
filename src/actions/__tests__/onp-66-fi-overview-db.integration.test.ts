import path from "path";
import fs from "fs";
import dotenv from "dotenv";

// a. Load .env.uat.local with override: true
const envUatLocal = path.resolve(process.cwd(), ".env.uat.local");
if (fs.existsSync(envUatLocal)) {
    dotenv.config({ path: envUatLocal, override: true });
}

// b. Set ONPRO_DB_TEST_ENV=uat
process.env.ONPRO_DB_TEST_ENV = "uat";

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { assertUatDbTestEnv } from "@/lib/kyc/__tests__/test-env-guard";

// c. Call assertUatDbTestEnv()
assertUatDbTestEnv();

let currentAuthUserId: string | null = null;
let currentAuthEmail: string | null = null;

vi.mock("@/lib/auth", () => ({
    getIdentity: vi.fn().mockImplementation(() => {
        if (!currentAuthUserId) return Promise.resolve(null);
        return Promise.resolve({
            userId: currentAuthUserId,
            email: currentAuthEmail || "test@example.com",
            role: "ORG_ADMIN",
        });
    }),
}));

vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });

// d. Dynamically imported references
let prisma: typeof import("@/lib/prisma").default;
let getSupplierRelationshipsSummary: typeof import("../fi").getSupplierRelationshipsSummary;

describe("ONP-66 — Real FI Relationship Data-Path Integration Proof (UAT Guarded)", () => {
    let testFiOrg: any;
    let testUnrelatedFiOrg: any;
    let testFiMemberUser: any;
    let testUnauthMemberUser: any;
    let testClientOrgA: any;
    let testClientOrgB: any;
    let testLeA1: any;
    let testLeA2: any;
    let testLeB1: any;
    let testLeUnrelated: any;
    let testLeDeleted: any;
    let testEng1: any;
    let testEng2: any;
    let testEng3: any;
    let testEngUnrelated: any;
    let testEngDeleted: any;

    const PREFIX = "ONP66_INT_";

    const cleanTestData = async () => {
        // 1. Delete engagements
        await prisma.fIEngagement.deleteMany({
            where: {
                OR: [
                    { org: { name: { startsWith: PREFIX } } },
                    { clientLE: { name: { startsWith: PREFIX } } },
                ],
            },
        });

        // 2. Delete client LE owners
        await prisma.clientLEOwner.deleteMany({
            where: {
                OR: [
                    { party: { name: { startsWith: PREFIX } } },
                    { clientLE: { name: { startsWith: PREFIX } } },
                ],
            },
        });

        // 3. Delete client LEs
        await prisma.clientLE.deleteMany({
            where: { name: { startsWith: PREFIX } },
        });

        // 4. Delete memberships
        await prisma.membership.deleteMany({
            where: {
                OR: [
                    { user: { email: { startsWith: PREFIX.toLowerCase() } } },
                    { organization: { name: { startsWith: PREFIX } } },
                ],
            },
        });

        // 5. Delete organizations
        await prisma.organization.deleteMany({
            where: { name: { startsWith: PREFIX } },
        });

        // 6. Delete users
        await prisma.user.deleteMany({
            where: { email: { startsWith: PREFIX.toLowerCase() } },
        });
    };

    beforeAll(async () => {
        // Enforce UAT safety guard
        assertUatDbTestEnv();

        // d. Dynamically import Prisma and DB-backed application action only after guard passes
        const prismaModule = await import("@/lib/prisma");
        prisma = prismaModule.default;
        const fiModule = await import("../fi");
        getSupplierRelationshipsSummary = fiModule.getSupplierRelationshipsSummary;

        await cleanTestData();

        const rand = Math.floor(Math.random() * 1000000);

        // 1. Primary FI Organization & Unrelated FI Organization
        testFiOrg = await prisma.organization.create({
            data: { name: `${PREFIX}Primary_FI_${rand}`, types: ["FI"] },
        });
        testUnrelatedFiOrg = await prisma.organization.create({
            data: { name: `${PREFIX}Unrelated_FI_${rand}`, types: ["FI"] },
        });

        // 2. Users: Authorized FI Member vs Unrelated User
        testFiMemberUser = await prisma.user.create({
            data: {
                email: `${PREFIX.toLowerCase()}member_${rand}@example.com`,
                name: `ONP66 FI Member User ${rand}`,
            },
        });

        await prisma.membership.create({
            data: {
                userId: testFiMemberUser.id,
                organizationId: testFiOrg.id,
                role: "ORG_ADMIN",
            },
        });

        testUnauthMemberUser = await prisma.user.create({
            data: {
                email: `${PREFIX.toLowerCase()}unauth_${rand}@example.com`,
                name: `ONP66 Unauth User ${rand}`,
            },
        });

        await prisma.membership.create({
            data: {
                userId: testUnauthMemberUser.id,
                organizationId: testUnrelatedFiOrg.id,
                role: "ORG_ADMIN",
            },
        });

        // 3. Client Organizations (Parties)
        testClientOrgA = await prisma.organization.create({
            data: { name: `${PREFIX}ClientOrg_Alpha_${rand}`, types: ["CLIENT"] },
        });
        testClientOrgB = await prisma.organization.create({
            data: { name: `${PREFIX}ClientOrg_Beta_${rand}`, types: ["CLIENT"] },
        });

        // 4. Client LEs
        testLeA1 = await prisma.clientLE.create({
            data: {
                name: `${PREFIX}ClientLE_Alpha_1_${rand}`,
                owners: { create: [{ partyId: testClientOrgA.id }] },
            },
        });
        testLeA2 = await prisma.clientLE.create({
            data: {
                name: `${PREFIX}ClientLE_Alpha_2_${rand}`,
                owners: { create: [{ partyId: testClientOrgA.id }] },
            },
        });
        testLeB1 = await prisma.clientLE.create({
            data: {
                name: `${PREFIX}ClientLE_Beta_1_${rand}`,
                owners: { create: [{ partyId: testClientOrgB.id }] },
            },
        });
        testLeUnrelated = await prisma.clientLE.create({
            data: {
                name: `${PREFIX}ClientLE_Unrelated_${rand}`,
                owners: { create: [{ partyId: testClientOrgA.id }] },
            },
        });
        testLeDeleted = await prisma.clientLE.create({
            data: {
                name: `${PREFIX}ClientLE_Deleted_${rand}`,
                owners: { create: [{ partyId: testClientOrgA.id }] },
            },
        });

        // 5. FI Engagements
        // Engagement 1: Active in Primary FI Org for LE A1
        testEng1 = await prisma.fIEngagement.create({
            data: {
                fiOrgId: testFiOrg.id,
                clientLEId: testLeA1.id,
                status: "CONNECTED",
                isDeleted: false,
            },
        });

        // Engagement 2: Active in Primary FI Org for LE A2
        testEng2 = await prisma.fIEngagement.create({
            data: {
                fiOrgId: testFiOrg.id,
                clientLEId: testLeA2.id,
                status: "CONNECTED",
                isDeleted: false,
            },
        });

        // Engagement 3: Active in Primary FI Org for LE B1
        testEng3 = await prisma.fIEngagement.create({
            data: {
                fiOrgId: testFiOrg.id,
                clientLEId: testLeB1.id,
                status: "CONNECTED",
                isDeleted: false,
            },
        });

        // Engagement 4: Active in Unrelated FI Org (should be excluded from testFiOrg queries)
        testEngUnrelated = await prisma.fIEngagement.create({
            data: {
                fiOrgId: testUnrelatedFiOrg.id,
                clientLEId: testLeUnrelated.id,
                status: "CONNECTED",
                isDeleted: false,
            },
        });

        // Engagement 5: Soft-deleted in Primary FI Org (should be excluded)
        testEngDeleted = await prisma.fIEngagement.create({
            data: {
                fiOrgId: testFiOrg.id,
                clientLEId: testLeDeleted.id,
                status: "CONNECTED",
                isDeleted: true,
            },
        });
    });

    afterAll(async () => {
        await cleanTestData();

        // Comprehensive verification: verify synthetic residue = 0 for EVERY created entity type
        const residueEng = await prisma.fIEngagement.count({
            where: {
                OR: [
                    { org: { name: { startsWith: PREFIX } } },
                    { clientLE: { name: { startsWith: PREFIX } } },
                ],
            },
        });
        const residueOwners = await prisma.clientLEOwner.count({
            where: {
                OR: [
                    { party: { name: { startsWith: PREFIX } } },
                    { clientLE: { name: { startsWith: PREFIX } } },
                ],
            },
        });
        const residueLE = await prisma.clientLE.count({
            where: { name: { startsWith: PREFIX } },
        });
        const residueMemberships = await prisma.membership.count({
            where: {
                OR: [
                    { user: { email: { startsWith: PREFIX.toLowerCase() } } },
                    { organization: { name: { startsWith: PREFIX } } },
                ],
            },
        });
        const residueOrg = await prisma.organization.count({
            where: { name: { startsWith: PREFIX } },
        });
        const residueUsers = await prisma.user.count({
            where: { email: { startsWith: PREFIX.toLowerCase() } },
        });

        expect(residueEng).toBe(0);
        expect(residueOwners).toBe(0);
        expect(residueLE).toBe(0);
        expect(residueMemberships).toBe(0);
        expect(residueOrg).toBe(0);
        expect(residueUsers).toBe(0);
    });

    it("1. Applicable FI member succeeds with real DB grouping across client orgs", async () => {
        currentAuthUserId = testFiMemberUser.id;
        currentAuthEmail = testFiMemberUser.email;

        const groups = await getSupplierRelationshipsSummary(testFiOrg.id);

        // Assert exactly 2 client organization groups
        expect(groups).toHaveLength(2);

        // Group A: Alpha client org with 2 legal entities
        const groupA = groups.find((g) => g.clientOrganizationId === testClientOrgA.id);
        expect(groupA).toBeDefined();
        expect(groupA?.clientOrganizationName).toBe(testClientOrgA.name);
        expect(groupA?.legalEntities).toHaveLength(2);
        const leIdsA = groupA?.legalEntities.map((le) => le.clientLEId).sort();
        expect(leIdsA).toEqual([testLeA1.id, testLeA2.id].sort());

        // Group B: Beta client org with 1 legal entity
        const groupB = groups.find((g) => g.clientOrganizationId === testClientOrgB.id);
        expect(groupB).toBeDefined();
        expect(groupB?.clientOrganizationName).toBe(testClientOrgB.name);
        expect(groupB?.legalEntities).toHaveLength(1);
        expect(groupB?.legalEntities[0].clientLEId).toBe(testLeB1.id);
    });

    it("2. Authenticated user without applicable FI membership is rejected (returns empty summary)", async () => {
        // User has membership in testUnrelatedFiOrg, NOT testFiOrg
        currentAuthUserId = testUnauthMemberUser.id;
        currentAuthEmail = testUnauthMemberUser.email;

        const groups = await getSupplierRelationshipsSummary(testFiOrg.id);
        expect(groups).toEqual([]);
    });

    it("3. Unrelated FI data and soft-deleted engagements are not exposed to FI member", async () => {
        currentAuthUserId = testFiMemberUser.id;
        currentAuthEmail = testFiMemberUser.email;

        // Query testFiOrg
        const groups = await getSupplierRelationshipsSummary(testFiOrg.id);
        const allLeIdsInSummary = groups.flatMap((g) => g.legalEntities.map((le) => le.clientLEId));

        // Assert unrelated engagement and deleted engagement are NOT present
        expect(allLeIdsInSummary).not.toContain(testLeUnrelated.id);
        expect(allLeIdsInSummary).not.toContain(testLeDeleted.id);

        // Query testUnrelatedFiOrg as testFiMemberUser (should be rejected)
        const unauthGroups = await getSupplierRelationshipsSummary(testUnrelatedFiOrg.id);
        expect(unauthGroups).toEqual([]);
    });
});
