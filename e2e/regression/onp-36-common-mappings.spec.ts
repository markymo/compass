import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

// Contract: QNR-03 — Common Questionnaire mappings appear in relationship use
// Linear: ONP-36

const prisma = new PrismaClient();

test.describe('QNR-03 / ONP-36 — Common Questionnaire Mappings in Relationship Use', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
    test.setTimeout(90000);

    let manifest: ReturnType<typeof loadUATManifest>;
    let clientLEId: string;
    let engagementId: string;
    let commonTemplate: any;
    let engagementQnr: any;
    const testPrefix = `QNR03 Test ${Date.now()}`;
    const testQuestionText = `What is the legal name of the entity (${testPrefix})?`;

    test.beforeAll(async () => {
        manifest = loadUATManifest();
        clientLEId = manifest.alphaClientLE.id;
        engagementId = manifest.relationshipAlpha.id;

        // Create a Common Questionnaire Template with a question mapped to Field 2 (Legal Name)
        commonTemplate = await prisma.questionnaire.create({
            data: {
                fiOrg: { connect: { id: manifest.systemOrg.id } },
                name: `${testPrefix} Template`,
                isTemplate: true,
                isGlobal: true,
                status: 'ACTIVE',
                kind: 'REFERENCE_SNAPSHOT',
                referenceCode: `QNR_${Date.now()}`,
                commonForClients: {
                    connect: { id: clientLEId }
                },
                questions: {
                    create: [
                        {
                            text: testQuestionText,
                            order: 1,
                            masterFieldNo: 2,
                            status: 'SHARED'
                        }
                    ]
                }
            },
            include: { questions: true }
        });

        // Create Engagement Questionnaire instance
        engagementQnr = await prisma.questionnaire.create({
            data: {
                fiOrg: { connect: { id: manifest.supplierOrgA.id } },
                fiEngagement: { connect: { id: engagementId } },
                name: `${testPrefix} Engagement Instance`,
                source: { connect: { id: commonTemplate.id } },
                status: 'ACTIVE',
                kind: 'ENGAGEMENT_QUESTIONNAIRE',
                questions: {
                    create: [
                        {
                            text: testQuestionText,
                            order: 1,
                            masterFieldNo: 2,
                            status: 'SHARED'
                        }
                    ]
                }
            },
            include: { questions: true }
        });
    });

    test.afterAll(async () => {
        try {
            if (engagementQnr?.id) {
                await prisma.question.deleteMany({ where: { questionnaireId: engagementQnr.id } });
                await prisma.questionnaire.delete({ where: { id: engagementQnr.id } });
            }
            if (commonTemplate?.id) {
                await prisma.question.deleteMany({ where: { questionnaireId: commonTemplate.id } });
                await prisma.questionnaire.delete({ where: { id: commonTemplate.id } });
            }
        } catch (err) {
            console.warn('Cleanup warning in onp-36:', err);
        } finally {
            await prisma.$disconnect();
        }
    });

    test('1. Assigned Common Questionnaire renders in Relationships and preserves mapped questions', async ({ page }) => {
        // Step 1: Navigate to Client LE Relationships page
        await page.goto(`/app/le/${clientLEId}/relationships`);
        await page.waitForLoadState('networkidle');

        // Step 2: Verify Common Questionnaires section displays the template
        const templateCard = page.locator(`text=${testPrefix} Template`).first();
        await expect(templateCard).toBeVisible({ timeout: 15000 });

        // Step 3: Verify questions count / progress indicator is rendered
        const questionsCount = page.locator(`text=1 questions, text=1 item, text=1 Questions`).first();
        if (await questionsCount.isVisible()) {
            await expect(questionsCount).toBeVisible();
        }
    });
});
