import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { assertUatDbTestEnv } from "@/lib/kyc/__tests__/test-env-guard";
import prisma from "@/lib/prisma";
import { getFieldUsageDetails } from "@/actions/client-le";

describe("Track B: ONP-40 Questionnaire Mapping Semantics (DB Integration)", () => {
    const timestamp = Date.now();
    const TEST_LE_ID = `le-entity-onp40-${timestamp}`;
    const TEST_CLIENT_LE_ID = `le-onp40-${timestamp}`;
    const TEST_ORG_ID = `org-onp40-${timestamp}`;
    const TEST_ORG_ARCHIVED_ID = `org-onp40-arc-${timestamp}`;
    const TEST_ENGAGEMENT_ACTIVE = `eng-onp40-act-${timestamp}`;
    const TEST_ENGAGEMENT_ARCHIVED = `eng-onp40-arc-${timestamp}`;

    let qnActiveId: string;
    let qnDeletedId: string;
    let qnTemplateId: string;
    let qnArchivedEngId: string;

    beforeAll(async () => {
        assertUatDbTestEnv();

        // 1. Seed LegalEntity and ClientLE
        await prisma.legalEntity.create({
            data: { id: TEST_LE_ID, name: "ONP40 Legal Entity", reference: `REF-${timestamp}` }
        });
        await prisma.clientLE.create({
            data: { id: TEST_CLIENT_LE_ID, name: "ONP40 Client LE", legalEntityId: TEST_LE_ID }
        });

        // 2. Seed Supplier Organizations
        await prisma.organization.create({
            data: {
                id: TEST_ORG_ID,
                name: "ONP40 Bank Org",
                shortCode: "ONP40B",
                types: ["FI"]
            }
        });
        await prisma.organization.create({
            data: {
                id: TEST_ORG_ARCHIVED_ID,
                name: "ONP40 Archived Bank Org",
                shortCode: "ONP40A",
                types: ["FI"]
            }
        });

        // 3. Seed Active Engagement
        await prisma.fIEngagement.create({
            data: {
                id: TEST_ENGAGEMENT_ACTIVE,
                clientLEId: TEST_CLIENT_LE_ID,
                fiOrgId: TEST_ORG_ID,
                status: "CONNECTED",
                isDeleted: false
            }
        });

        // 4. Seed Archived Engagement
        await prisma.fIEngagement.create({
            data: {
                id: TEST_ENGAGEMENT_ARCHIVED,
                clientLEId: TEST_CLIENT_LE_ID,
                fiOrgId: TEST_ORG_ARCHIVED_ID,
                status: "ARCHIVED",
                isDeleted: false
            }
        });

        // 5. Seed Questionnaires
        // A. Active questionnaire on active engagement
        const qnActive = await prisma.questionnaire.create({
            data: {
                name: "ONP40 Active Questionnaire",
                fiOrgId: TEST_ORG_ID,
                fiEngagementId: TEST_ENGAGEMENT_ACTIVE,
                isDeleted: false,
                isTemplate: false
            }
        });
        qnActiveId = qnActive.id;

        // Question mapped to Field 138
        await prisma.question.create({
            data: {
                questionnaireId: qnActiveId,
                text: "What is your registered office address?",
                masterFieldNo: 138,
                order: 1
            }
        });

        // B. Deleted questionnaire on active engagement
        const qnDeleted = await prisma.questionnaire.create({
            data: {
                name: "ONP40 Deleted Questionnaire",
                fiOrgId: TEST_ORG_ID,
                fiEngagementId: TEST_ENGAGEMENT_ACTIVE,
                isDeleted: true,
                isTemplate: false
            }
        });
        qnDeletedId = qnDeleted.id;

        await prisma.question.create({
            data: {
                questionnaireId: qnDeletedId,
                text: "Deleted QN question?",
                masterFieldNo: 138,
                order: 1
            }
        });

        // C. Template questionnaire
        const qnTemplate = await prisma.questionnaire.create({
            data: {
                name: "ONP40 Template Questionnaire",
                fiOrgId: TEST_ORG_ID,
                fiEngagementId: TEST_ENGAGEMENT_ACTIVE,
                isDeleted: false,
                isTemplate: true
            }
        });
        qnTemplateId = qnTemplate.id;

        await prisma.question.create({
            data: {
                questionnaireId: qnTemplateId,
                text: "Template QN question?",
                masterFieldNo: 138,
                order: 1
            }
        });

        // D. Questionnaire on archived engagement
        const qnArchived = await prisma.questionnaire.create({
            data: {
                name: "ONP40 Archived Eng Questionnaire",
                fiOrgId: TEST_ORG_ARCHIVED_ID,
                fiEngagementId: TEST_ENGAGEMENT_ARCHIVED,
                isDeleted: false,
                isTemplate: false
            }
        });
        qnArchivedEngId = qnArchived.id;

        await prisma.question.create({
            data: {
                questionnaireId: qnArchivedEngId,
                text: "Archived engagement question?",
                masterFieldNo: 138,
                order: 1
            }
        });
    });

    afterAll(async () => {
        try {
            const validQnIds = [qnActiveId, qnDeletedId, qnTemplateId, qnArchivedEngId].filter(Boolean);
            if (validQnIds.length > 0) {
                await prisma.question.deleteMany({
                    where: { questionnaireId: { in: validQnIds } }
                });
                await prisma.questionnaire.deleteMany({
                    where: { id: { in: validQnIds } }
                });
            }
            await prisma.fIEngagement.deleteMany({
                where: { id: { in: [TEST_ENGAGEMENT_ACTIVE, TEST_ENGAGEMENT_ARCHIVED] } }
            });
            await prisma.clientLE.deleteMany({
                where: { id: TEST_CLIENT_LE_ID }
            });
            await prisma.legalEntity.deleteMany({
                where: { id: TEST_LE_ID }
            });
            await prisma.organization.deleteMany({
                where: { id: { in: [TEST_ORG_ID, TEST_ORG_ARCHIVED_ID] } }
            });
        } catch (e) {
            console.error("Cleanup error in onp-40-mapping-semantics.test.ts:", e);
        }
    });

    it("ONP-40 SEMANTICS: getFieldUsageDetails includes active mapped questions and strictly excludes deleted, template, and archived questionnaires", async () => {
        const usage = await getFieldUsageDetails(TEST_CLIENT_LE_ID, 138);

        // 1. Active question is included
        expect(usage.totalQuestions).toBe(1);
        expect(usage.totalQuestionnaires).toBe(1);
        expect(usage.totalSuppliers).toBe(1);

        // 2. Relationship contains only the active questionnaire
        const rel = usage.relationships.find(r => r.supplierId === TEST_ORG_ID);
        expect(rel).toBeDefined();
        expect(rel?.questionnaires).toHaveLength(1);
        expect(rel?.questionnaires[0].questionnaireId).toBe(qnActiveId);
        expect(rel?.questionnaires[0].questions[0].text).toBe("What is your registered office address?");

        // 3. Excluded items are not present
        const qnIds = usage.questionnaires.map(q => q.id);
        expect(qnIds).toContain(qnActiveId);
        expect(qnIds).not.toContain(qnDeletedId);
        expect(qnIds).not.toContain(qnTemplateId);
        expect(qnIds).not.toContain(qnArchivedEngId);
    });
});
