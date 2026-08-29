import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

const prisma = new PrismaClient();

test.describe('QNR-01 / ONP-68 — Supplier Questionnaire Navigation & Review Journey', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.supplierOrgAdminA });
    test.setTimeout(120000);

    let manifest: ReturnType<typeof loadUATManifest>;
    let supplierOrgId: string;
    let engagementId: string;
    let createdQuestionnaireId: string | null = null;
    let questionnaireName: string;

    test.beforeAll(async () => {
        manifest = loadUATManifest();
        supplierOrgId = manifest.supplierOrgA.id;
        engagementId = manifest.relationshipAlpha.id;
        questionnaireName = `QNR01 Deterministic Questionnaire ${Date.now()}`;

        // Verify if relationship has existing non-deleted questionnaires
        const existing = await prisma.questionnaire.findFirst({
            where: {
                fiEngagementId: engagementId,
                isDeleted: false,
            },
            include: { questions: true }
        });

        if (!existing) {
            // Create a deterministic questionnaire instance for this engagement
            const q = await prisma.questionnaire.create({
                data: {
                    name: questionnaireName,
                    fiOrgId: supplierOrgId,
                    fiEngagementId: engagementId,
                    status: 'ACTIVE',
                    isDeleted: false,
                    isTemplate: false,
                    questions: {
                        create: [
                            {
                                text: 'What is the full legal name of the entity?',
                                order: 1,
                                status: 'SHARED',
                                masterFieldNo: 3,
                            }
                        ]
                    }
                }
            });
            createdQuestionnaireId = q.id;
        } else {
            questionnaireName = existing.name;
        }
    });

    test.afterAll(async () => {
        if (createdQuestionnaireId) {
            await prisma.question.deleteMany({ where: { questionnaireId: createdQuestionnaireId } });
            await prisma.questionnaire.deleteMany({ where: { id: createdQuestionnaireId } });
        }
        await prisma.$disconnect();
    });

    test('Supplier Org -> relationship -> visible questionnaire -> click review control -> Questions & Answers loads without 404 -> reload works', async ({ page }) => {
        // 1. Navigate to Supplier Org overview
        await page.goto(`/app/s/${supplierOrgId}`);
        await expect(page.getByRole('heading', { name: 'Client Relationships' })).toBeVisible({ timeout: 15000 });

        // 2. Expand Client Relationship accordion if not already expanded
        const clientGroupHeader = page.getByText(manifest.clientOrgA.name);
        await expect(clientGroupHeader).toBeVisible();

        const leNameElement = page.getByText(manifest.alphaClientLE.name);
        if (!(await leNameElement.isVisible())) {
            // Click to expand client group
            await clientGroupHeader.click();
            await expect(leNameElement).toBeVisible({ timeout: 5000 });
        }

        // 3. Expand the Client LE row if questionnaire is not yet visible
        const qElement = page.getByText(questionnaireName);
        if (!(await qElement.isVisible())) {
            await leNameElement.click();
            await expect(qElement).toBeVisible({ timeout: 5000 });
        }

        // 4. Locate and click the actual "Review questionnaire" control within the questionnaire card
        const qCard = page.locator('div').filter({ hasText: questionnaireName }).filter({ hasText: 'Review questionnaire' }).last();
        const reviewBtn = qCard.getByRole('button', { name: /Review questionnaire/i });
        await expect(reviewBtn).toBeVisible();

        await reviewBtn.click();

        // 5. Assert navigation lands on Questions & Answers workbench with query params
        await expect(page).toHaveURL(new RegExp(`/app/s/${supplierOrgId}/questions`));
        await expect(page.getByRole('heading', { name: 'Questions & Answers' })).toBeVisible({ timeout: 15000 });

        // 6. Assert there is NO 404 error and page content is populated
        await expect(page.getByText('404')).not.toBeVisible();
        await expect(page.getByText(/This page could not be found/i)).not.toBeVisible();

        // 7. Assert reload works cleanly without 404
        await page.reload();
        await expect(page.getByRole('heading', { name: 'Questions & Answers' })).toBeVisible({ timeout: 15000 });
        await expect(page.getByText('404')).not.toBeVisible();
        await expect(page.getByText(/This page could not be found/i)).not.toBeVisible();
    });
});
