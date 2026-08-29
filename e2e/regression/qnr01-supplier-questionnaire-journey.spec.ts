import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

const prisma = new PrismaClient();

test.describe('QNR-01 / ONP-68 — Supplier Questionnaire Navigation & Review Journey', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.supplierOrgAdminA });
    test.setTimeout(120000);

    let supplierOrgId: string;
    let engagementId: string;
    let clientOrgName: string;
    let clientLEName: string;
    let createdQuestionnaireId: string | null = null;
    let questionnaireName: string;

    test.beforeAll(async () => {
        // Query supplier user to get their active supplier organization
        const supplierUser = await prisma.user.findFirst({
            where: { email: 'uat+supplier-org-admin@onpro.tech' },
            include: { memberships: { include: { organization: true } } }
        });

        const supplierMembership = supplierUser?.memberships.find(m =>
            m.organization?.types.some(t => ['FI', 'SUPPLIER', 'LAW_FIRM', 'OTHER'].includes(t))
        );

        if (!supplierMembership?.organizationId) {
            throw new Error('Could not find supplier organization membership for uat+supplier-org-admin@onpro.tech');
        }

        supplierOrgId = supplierMembership.organizationId;

        // Find active engagement for this supplier
        const engagement = await prisma.fIEngagement.findFirst({
            where: {
                fiOrgId: supplierOrgId,
                isDeleted: false,
            },
            include: {
                clientLE: {
                    include: {
                        memberships: {
                            include: { organization: true }
                        }
                    }
                },
                questionnaires: {
                    where: { isDeleted: false }
                }
            }
        });

        if (!engagement || !engagement.clientLE) {
            throw new Error(`No active engagement found for supplier org ${supplierOrgId}`);
        }

        engagementId = engagement.id;
        clientLEName = engagement.clientLE.name;
        // Determine client org name
        const clientOrgMembership = engagement.clientLE.memberships?.find(m => m.organization?.types.includes('CLIENT'));
        clientOrgName = clientOrgMembership?.organization?.name || 'UAT Client Org A';

        questionnaireName = `QNR01 Review Journey ${Date.now()}`;

        // Ensure a deterministic questionnaire instance exists on this engagement
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
                            text: 'What is the full legal entity name?',
                            order: 1,
                            status: 'SHARED',
                            masterFieldNo: 3,
                        }
                    ]
                }
            }
        });
        createdQuestionnaireId = q.id;
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
        await expect(page.getByRole('heading', { name: 'Client Relationships' })).toBeVisible({ timeout: 20000 });

        // 2. Locate the client group header and legal entity row
        const clientGroup = page.locator('div').filter({ hasText: clientOrgName }).first();
        if (await clientGroup.isVisible()) {
            // Ensure client group is expanded
            const leRow = page.getByText(clientLEName);
            if (!(await leRow.isVisible())) {
                await clientGroup.click();
            }
        }

        // 3. Expand the Client LE row if the questionnaire is not yet visible
        const qText = page.getByText(questionnaireName);
        if (!(await qText.isVisible())) {
            const leButton = page.getByText(clientLEName).first();
            await leButton.click();
            await expect(qText).toBeVisible({ timeout: 10000 });
        }

        // 4. Locate and click the actual "Review questionnaire" control within the questionnaire card
        const qCard = page.locator('div').filter({ hasText: questionnaireName }).filter({ hasText: 'Review questionnaire' }).last();
        const reviewBtn = qCard.getByRole('button', { name: /Review questionnaire/i });
        await expect(reviewBtn).toBeVisible();

        await reviewBtn.click();

        // 5. Assert navigation lands on Questions & Answers workbench with query params
        await expect(page).toHaveURL(new RegExp(`/app/s/${supplierOrgId}/questions`));
        await expect(page.getByRole('heading', { name: 'Questions & Answers' })).toBeVisible({ timeout: 20000 });

        // 6. Assert there is NO 404 error and page content is populated
        await expect(page.getByText('404')).not.toBeVisible();
        await expect(page.getByText(/This page could not be found/i)).not.toBeVisible();

        // 7. Assert reload works cleanly without 404
        await page.reload();
        await expect(page.getByRole('heading', { name: 'Questions & Answers' })).toBeVisible({ timeout: 20000 });
        await expect(page.getByText('404')).not.toBeVisible();
        await expect(page.getByText(/This page could not be found/i)).not.toBeVisible();
    });
});
