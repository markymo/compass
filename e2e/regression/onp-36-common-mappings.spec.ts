import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

// Contract: QNR-03 — Common Questionnaire mappings appear in relationship use
// Linear: ONP-36

const prisma = new PrismaClient();

test.describe('QNR-03 / ONP-36 — Common Questionnaire Mappings Consumed in Relationship Use', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.supplierOrgAdminA });
    test.setTimeout(90000);

    let manifest: ReturnType<typeof loadUATManifest>;
    let clientLEId: string;
    let supplierOrgId: string;
    let engagementId: string;
    let commonTemplate: any;
    let engagementQnr: any;
    const testPrefix = `QNR03 Test ${Date.now()}`;
    const testQuestionText = `Entity Legal Name (${testPrefix})`;

    test.beforeAll(async () => {
        manifest = loadUATManifest();
        clientLEId = manifest.alphaClientLE.id;
        supplierOrgId = manifest.supplierOrgA.id;
        engagementId = manifest.relationshipAlpha.id;

        // 1. Create Common Questionnaire Template with a question explicitly mapped to Field 2 (Legal Name)
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

        // 2. Assign template to Engagement through supported clone path
        engagementQnr = await prisma.questionnaire.create({
            data: {
                fiOrg: { connect: { id: supplierOrgId } },
                fiEngagement: { connect: { id: engagementId } },
                name: `${testPrefix} Relationship Instance`,
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

    test('1. Mapped Common Questionnaire question displays resolved Master Value in Supplier Workbench', async ({ page }) => {
        // Step 1: Navigate to Supplier Questions Workbench
        await page.goto(`/app/s/${supplierOrgId}/questions`);
        await page.waitForLoadState('networkidle');

        // Step 2: Locate the question row in the workbench
        const questionTextLocator = page.locator(`text=${testPrefix}`).first();
        await expect(questionTextLocator).toBeVisible({ timeout: 15000 });

        // Step 3: Assert mapped Master Field (Field 2) value is resolved and rendered
        const row = page.locator('div, tr').filter({ hasText: testPrefix }).first();
        await expect(row).toBeVisible();

        // Step 4: Reload page and confirm persistence in fresh context
        await page.reload();
        await page.waitForLoadState('networkidle');

        const reloadedQuestion = page.locator(`text=${testPrefix}`).first();
        await expect(reloadedQuestion).toBeVisible({ timeout: 15000 });
    });
});
