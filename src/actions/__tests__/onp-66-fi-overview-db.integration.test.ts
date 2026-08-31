import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import prisma from "@/lib/prisma";
import { getSupplierRelationshipsSummary } from "../fi";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

const envUatLocal = path.resolve(process.cwd(), ".env.uat.local");
if (fs.existsSync(envUatLocal)) {
    dotenv.config({ path: envUatLocal, override: false });
}

vi.mock("@/lib/auth", () => ({
    getIdentity: vi.fn(),
}));

vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });

describe.skipIf(!process.env.DATABASE_URL)("ONP-66 — Real FI Relationship Data-Path Integration Proof", () => {
    let testFiOrg: any;
    let testUnrelatedFiOrg: any;
    let testUser: any;
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
        // Delete engagements
        await prisma.fIEngagement.deleteMany({
            where: {
                OR: [
                    { org: { name: { startsWith: PREFIX } } },
                    { clientLE: { name: { startsWith: PREFIX } } },
                ],
            },
        });

        // Delete client LE owners
        await prisma.clientLEOwner.deleteMany({
            where: {
                OR: [
                    { party: { name: { startsWith: PREFIX } } },
                    { clientLE: { name: { startsWith: PREFIX } } },
                ],
            },
        });

        // Delete client LEs
        await prisma.clientLE.deleteMany({
            where: { name: { startsWith: PREFIX } },
        });

        // Delete memberships
        await prisma.membership.deleteMany({
            where: { user: { email: { startsWith: PREFIX.toLowerCase() } } },
        });

        // Delete organizations
        await prisma.organization.deleteMany({
            where: { name: { startsWith: PREFIX } },
        });

        // Delete user
        await prisma.user.deleteMany({
            where: { email: { startsWith: PREFIX.toLowerCase() } },
        });
    };

    beforeEach(async () => {
        await cleanTestData();

        const rand = Math.floor(Math.random() * 1000000);

        // 1. Primary FI Organization & Unrelated FI Organization
        testFiOrg = await prisma.organization.create({
            data: { name: `${PREFIX}Primary_FI_${rand}`, types: ["FI"] },
        });
        testUnrelatedFiOrg = await prisma.organization.create({
            data: { name: `${PREFIX}Unrelated_FI_${rand}`, types: ["FI"] },
        });

        // 2. User with membership in Primary FI Org
        testUser = await prisma.user.create({
            data: {
                email: `${PREFIX.toLowerCase()}user_${rand}@example.com`,
                name: `ONP66 Test User ${rand}`,
            },
        });

        await prisma.membership.create({
            data: {
                userId: testUser.id,
                organizationId: testFiOrg.id,
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

        // Engagement 4: Active in Unrelated FI Org (should be excluded)
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

        const { getIdentity } = await import("@/lib/auth");
        vi.mocked(getIdentity).mockResolvedValue({
            userId: testUser.id,
            email: testUser.email,
            role: "ORG_ADMIN",
        } as any);
    });

    afterAll(async () => {
        await cleanTestData();

        // Verify synthetic residue = 0
        const residueEng = await prisma.fIEngagement.count({
            where: {
                OR: [
                    { org: { name: { startsWith: PREFIX } } },
                    { clientLE: { name: { startsWith: PREFIX } } },
                ],
            },
        });
        const residueLE = await prisma.clientLE.count({
            where: { name: { startsWith: PREFIX } },
        });
        const residueOrg = await prisma.organization.count({
            where: { name: { startsWith: PREFIX } },
        });

        expect(residueEng).toBe(0);
        expect(residueLE).toBe(0);
        expect(residueOrg).toBe(0);
    });

    it("1. Queries real database and correctly groups relationships across client orgs while isolating unrelated/deleted data", async () => {
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

        // Assert unrelated engagement and deleted engagement are NOT present
        const allLeIdsInSummary = groups.flatMap((g) => g.legalEntities.map((le) => le.clientLEId));
        expect(allLeIdsInSummary).not.toContain(testLeUnrelated.id);
        expect(allLeIdsInSummary).not.toContain(testLeDeleted.id);
    });
});
