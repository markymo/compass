import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { assertUatDbTestEnv } from "@/lib/kyc/__tests__/test-env-guard";
import prisma from "@/lib/prisma";
import { getFieldUsageDetails } from "@/actions/client-le";

let mockUserId = "usr-onp97-test";

// Mock auth so getIdentity returns mockUserId
vi.mock("@/lib/auth", () => ({
    getIdentity: vi.fn().mockImplementation(() => Promise.resolve({
        userId: mockUserId,
        email: "uat+onp97@onpro.tech",
        role: "LE_ADMIN",
        orgId: "org-onp97-test"
    }))
}));

describe("Track B: ONP-97 Master Field Usage Authorization Boundary (DB Integration)", () => {
    const timestamp = Date.now();
    const TEST_AUTH_USER_ID = `usr-onp97-auth-${timestamp}`;
    const TEST_UNAUTH_USER_ID = `usr-onp97-unauth-${timestamp}`;

    const TEST_LE_A_ID = `le-entity-onp97-a-${timestamp}`;
    const TEST_CLIENT_LE_A_ID = `le-onp97-a-${timestamp}`;
    const TEST_ORG_A_ID = `org-onp97-a-${timestamp}`;
    const TEST_ENGAGEMENT_A_ID = `eng-onp97-a-${timestamp}`;

    const TEST_LE_B_ID = `le-entity-onp97-b-${timestamp}`;
    const TEST_CLIENT_LE_B_ID = `le-onp97-b-${timestamp}`;
    const TEST_ORG_B_ID = `org-onp97-b-${timestamp}`;
    const TEST_ENGAGEMENT_B_ID = `eng-onp97-b-${timestamp}`;

    let qnAId: string;
    let qnBId: string;

    beforeAll(async () => {
        assertUatDbTestEnv();

        // 1. Seed Users
        await prisma.user.create({
            data: { id: TEST_AUTH_USER_ID, email: `onp97-auth-${timestamp}@test.onpro.tech`, name: "Authorized User" }
        });
        await prisma.user.create({
            data: { id: TEST_UNAUTH_USER_ID, email: `onp97-unauth-${timestamp}@test.onpro.tech`, name: "Unauthorized User" }
        });

        // 2. Seed Dossier A (Accessible to Authorized User)
        await prisma.legalEntity.create({
            data: { id: TEST_LE_A_ID, name: "Dossier A LE", reference: `REF-A-${timestamp}` }
        });
        await prisma.clientLE.create({
            data: { id: TEST_CLIENT_LE_A_ID, name: "Dossier A ClientLE", legalEntityId: TEST_LE_A_ID }
        });
        await prisma.membership.create({
            data: { userId: TEST_AUTH_USER_ID, clientLEId: TEST_CLIENT_LE_A_ID, role: "LE_ADMIN" }
        });
        await prisma.organization.create({
            data: { id: TEST_ORG_A_ID, name: "Secret Bank Alpha", shortCode: "BKALP", types: ["FI"] }
        });
        await prisma.fIEngagement.create({
            data: { id: TEST_ENGAGEMENT_A_ID, clientLEId: TEST_CLIENT_LE_A_ID, fiOrgId: TEST_ORG_A_ID, status: "CONNECTED", isDeleted: false }
        });
        const qnA = await prisma.questionnaire.create({
            data: { name: "Confidential Alpha Questionnaire", fiOrgId: TEST_ORG_A_ID, fiEngagementId: TEST_ENGAGEMENT_A_ID, isDeleted: false, isTemplate: false }
        });
        qnAId = qnA.id;
        await prisma.question.create({
            data: { questionnaireId: qnAId, text: "Alpha Secret Question 1", masterFieldNo: 138, order: 1 }
        });

        // 3. Seed Dossier B (Inaccessible to Unauthorized User, and contains confidential Dossier B supplier & questionnaire data)
        await prisma.legalEntity.create({
            data: { id: TEST_LE_B_ID, name: "Dossier B LE", reference: `REF-B-${timestamp}` }
        });
        await prisma.clientLE.create({
            data: { id: TEST_CLIENT_LE_B_ID, name: "Dossier B ClientLE", legalEntityId: TEST_LE_B_ID }
        });
        await prisma.organization.create({
            data: { id: TEST_ORG_B_ID, name: "Confidential Supplier Bravo", shortCode: "BRV", types: ["FI"] }
        });
        await prisma.fIEngagement.create({
            data: { id: TEST_ENGAGEMENT_B_ID, clientLEId: TEST_CLIENT_LE_B_ID, fiOrgId: TEST_ORG_B_ID, status: "CONNECTED", isDeleted: false }
        });
        const qnB = await prisma.questionnaire.create({
            data: { name: "Restricted Bravo Questionnaire", fiOrgId: TEST_ORG_B_ID, fiEngagementId: TEST_ENGAGEMENT_B_ID, isDeleted: false, isTemplate: false }
        });
        qnBId = qnB.id;
        await prisma.question.create({
            data: { questionnaireId: qnBId, text: "Bravo Confidential Compliance Inquiry", masterFieldNo: 138, order: 1 }
        });
    });

    afterAll(async () => {
        try {
            const validQnIds = [qnAId, qnBId].filter(Boolean);
            if (validQnIds.length > 0) {
                await prisma.question.deleteMany({ where: { questionnaireId: { in: validQnIds } } });
                await prisma.questionnaire.deleteMany({ where: { id: { in: validQnIds } } });
            }
            await prisma.fIEngagement.deleteMany({ where: { id: { in: [TEST_ENGAGEMENT_A_ID, TEST_ENGAGEMENT_B_ID] } } });
            await prisma.membership.deleteMany({ where: { clientLEId: { in: [TEST_CLIENT_LE_A_ID, TEST_CLIENT_LE_B_ID] } } });
            await prisma.clientLE.deleteMany({ where: { id: { in: [TEST_CLIENT_LE_A_ID, TEST_CLIENT_LE_B_ID] } } });
            await prisma.legalEntity.deleteMany({ where: { id: { in: [TEST_LE_A_ID, TEST_LE_B_ID] } } });
            await prisma.organization.deleteMany({ where: { id: { in: [TEST_ORG_A_ID, TEST_ORG_B_ID] } } });
            await prisma.membership.deleteMany({ where: { userId: { in: [TEST_AUTH_USER_ID, TEST_UNAUTH_USER_ID] } } });
            await prisma.user.deleteMany({ where: { id: { in: [TEST_AUTH_USER_ID, TEST_UNAUTH_USER_ID] } } });
        } catch (e) {
            console.error("Cleanup error in onp-97-field-usage-auth.test.ts:", e);
        }
    });

    it("FIELD-USAGE-AUTH-01: Authorized LE user with LE_VIEW_MASTER_DATA permission may call getFieldUsageDetails", async () => {
        mockUserId = TEST_AUTH_USER_ID;

        const result = await getFieldUsageDetails(TEST_CLIENT_LE_A_ID, 138);

        expect(result).toBeDefined();
        expect(result.totalQuestions).toBe(1);
        expect(result.totalQuestionnaires).toBe(1);
        expect(result.totalSuppliers).toBe(1);
        expect(result.relationships[0].supplierName).toBe("Secret Bank Alpha");
    });

    it("FIELD-USAGE-AUTH-02: Authenticated user without access to that ClientLE is rejected with Unauthorized error", async () => {
        mockUserId = TEST_UNAUTH_USER_ID;

        // User is logged in, but has NO membership in Dossier A or Dossier B
        await expect(getFieldUsageDetails(TEST_CLIENT_LE_A_ID, 138)).rejects.toThrow(/Unauthorized/i);
        await expect(getFieldUsageDetails(TEST_CLIENT_LE_B_ID, 138)).rejects.toThrow(/Unauthorized/i);
    });

    it("FIELD-USAGE-AUTH-03: Direct cross-dossier invocation cannot return supplier, questionnaire, or question text from an inaccessible ClientLE", async () => {
        // User is authorized ONLY for Dossier A, attempts to read Dossier B
        mockUserId = TEST_AUTH_USER_ID;

        await expect(getFieldUsageDetails(TEST_CLIENT_LE_B_ID, 138)).rejects.toThrow(/Unauthorized/i);
    });
});
